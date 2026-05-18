<?php

namespace Tests\Feature\Seller;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use App\Services\InvoiceService;
use Carbon\Carbon;
use Tests\TestCase;

/**
 * 仕様書「免税事業者向け支払通知書 計算ロジック」§6 のテストケース1〜5 と、
 * 課税事業者（インボイス登録あり）の動作を検証する。
 *
 * 計算対象:
 *   落札金額（税抜）  ¥150,950（80%期）/ ¥10,005（端数検証）
 *   手数料（税抜）    ¥15,095 / ¥1,001
 *
 * 検証ポイント:
 *   - SettlementController::show のレスポンスが winning_tax_rate / is_tax_exempt 等を返す
 *   - 経過措置率（80%/50%/0%）に応じた振込額の正しさ
 *   - 端数（切り捨て）処理
 *   - 課税事業者（番号登録あり）は従来通り 10% 一律
 */
class SettlementTaxExemptTest extends TestCase
{
    protected User $admin;
    protected User $seller;
    protected SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->seller = $this->createSeller();
        // 既定: 免税事業者（インボイス番号なし）
        $this->sellerProfile = SellerProfile::factory()->create([
            'user_id' => $this->seller->id,
            'business_registration_number' => null,
        ]);
    }

    /**
     * 仕様書 §6 ケース1: 80%期・標準データ
     */
    public function test_case1_tax_exempt_winning_tax_8_percent_period(): void
    {
        [$auctionId] = $this->setupSettlement(
            eventDate: '2026-05-18',
            winningPrice: 150950,
            commission: 15095,
        );

        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson("/api/seller/settlements/{$auctionId}");

        $response->assertStatus(200);
        $settlement = $response->json('data.settlement');

        $this->assertTrue($settlement['is_tax_exempt']);
        $this->assertSame(8.0, (float) $settlement['winning_tax_rate']);
        $this->assertSame(10.0, (float) $settlement['commission_tax_rate']);
        $this->assertSame(0.8, (float) $settlement['transition_rate']);
        $this->assertSame(150950, $settlement['subtotal_winning']);
        $this->assertSame(12076, $settlement['tax_winning']);
        $this->assertSame(15095, $settlement['subtotal_commission']);
        $this->assertSame(1509, $settlement['tax_commission']);
        $this->assertSame(163026, $settlement['total_winning_with_tax']);
        $this->assertSame(16604, $settlement['total_commission_with_tax']);
        $this->assertSame(146422, $settlement['net_amount']);
    }

    /**
     * 仕様書 §6 ケース2: 50%期・標準データ
     */
    public function test_case2_tax_exempt_winning_tax_5_percent_period(): void
    {
        [$auctionId] = $this->setupSettlement(
            eventDate: '2027-01-15',
            winningPrice: 150950,
            commission: 15095,
        );

        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson("/api/seller/settlements/{$auctionId}");

        $response->assertStatus(200);
        $settlement = $response->json('data.settlement');

        $this->assertTrue($settlement['is_tax_exempt']);
        $this->assertSame(5.0, (float) $settlement['winning_tax_rate']);
        $this->assertSame(0.5, (float) $settlement['transition_rate']);
        $this->assertSame(7547, $settlement['tax_winning']); // floor(150950 * 0.05)
        $this->assertSame(1509, $settlement['tax_commission']);
        $this->assertSame(158497, $settlement['total_winning_with_tax']);
        $this->assertSame(141893, $settlement['net_amount']);
    }

    /**
     * 仕様書 §6 ケース3: 0%期・標準データ
     */
    public function test_case3_tax_exempt_winning_tax_0_percent_period(): void
    {
        [$auctionId] = $this->setupSettlement(
            eventDate: '2030-01-15',
            winningPrice: 150950,
            commission: 15095,
        );

        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson("/api/seller/settlements/{$auctionId}");

        $response->assertStatus(200);
        $settlement = $response->json('data.settlement');

        $this->assertTrue($settlement['is_tax_exempt']);
        $this->assertSame(0.0, (float) $settlement['winning_tax_rate']);
        $this->assertSame(0.0, (float) $settlement['transition_rate']);
        $this->assertSame(0, $settlement['tax_winning']);
        $this->assertSame(1509, $settlement['tax_commission']);
        $this->assertSame(150950, $settlement['total_winning_with_tax']);
        $this->assertSame(134346, $settlement['net_amount']);
    }

    /**
     * 仕様書 §6 ケース4: 端数処理確認（80%期）
     */
    public function test_case4_tax_exempt_floor_rounding(): void
    {
        [$auctionId] = $this->setupSettlement(
            eventDate: '2026-05-18',
            winningPrice: 10005,
            commission: 1001,
        );

        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson("/api/seller/settlements/{$auctionId}");

        $settlement = $response->json('data.settlement');

        $this->assertSame(800, $settlement['tax_winning']); // floor(10005 * 0.08) = floor(800.4)
        $this->assertSame(10805, $settlement['total_winning_with_tax']);
        $this->assertSame(100, $settlement['tax_commission']); // floor(1001 * 0.10) = floor(100.1)
        $this->assertSame(1101, $settlement['total_commission_with_tax']);
        $this->assertSame(9704, $settlement['net_amount']);
    }

    /**
     * 仕様書 §6 ケース5: 課税事業者（インボイス登録あり）→ 落札・手数料ともに 10%
     */
    public function test_case5_taxable_business_uses_flat_10_percent(): void
    {
        $this->sellerProfile->update([
            'business_registration_number' => 'T1234567890123',
        ]);

        [$auctionId] = $this->setupSettlement(
            eventDate: '2026-05-18',
            winningPrice: 150950,
            commission: 15095,
        );

        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson("/api/seller/settlements/{$auctionId}");

        $settlement = $response->json('data.settlement');

        $this->assertFalse($settlement['is_tax_exempt']);
        $this->assertSame(10.0, (float) $settlement['winning_tax_rate']);
        $this->assertSame(10.0, (float) $settlement['commission_tax_rate']);
        $this->assertNull($settlement['transition_rate']);
        $this->assertSame(15095, $settlement['tax_winning']); // floor(150950 * 0.10) = 15095
        $this->assertSame(166045, $settlement['total_winning_with_tax']);
        $this->assertSame(16604, $settlement['total_commission_with_tax']);
        $this->assertSame(149441, $settlement['net_amount']);
    }

    /**
     * 不正なフォーマットの番号（T+13桁を満たさない）は免税扱いに倒れる。
     */
    public function test_invalid_invoice_number_falls_back_to_tax_exempt(): void
    {
        $this->sellerProfile->update([
            'business_registration_number' => 'T123', // 桁数不足
        ]);

        [$auctionId] = $this->setupSettlement(
            eventDate: '2026-05-18',
            winningPrice: 150950,
            commission: 15095,
        );

        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson("/api/seller/settlements/{$auctionId}");

        $settlement = $response->json('data.settlement');
        $this->assertTrue($settlement['is_tax_exempt']);
        $this->assertSame(8.0, (float) $settlement['winning_tax_rate']);
    }

    /**
     * PDF 出力: 免税事業者でも PDF 生成が落ちないこと
     */
    public function test_pdf_generates_for_tax_exempt_seller(): void
    {
        [, $auction] = $this->setupSettlement(
            eventDate: '2026-05-18',
            winningPrice: 150950,
            commission: 15095,
        );

        $pdf = app(InvoiceService::class)->generateSellerPaymentNotice($auction, $this->sellerProfile);
        $this->assertNotEmpty($pdf->output());
    }

    /**
     * @return array{0:int,1:Auction}
     */
    private function setupSettlement(string $eventDate, int $winningPrice, int $commission): array
    {
        $auction = Auction::factory()->finished()->create([
            'created_by' => $this->admin->id,
            'event_date' => Carbon::parse($eventDate),
        ]);

        $item = Item::factory()->sold()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $winner = $this->createParticipant();
        WonItem::factory()->confirmed()->create([
            'item_id' => $item->id,
            'winner_id' => $winner->id,
            'winning_price' => $winningPrice,
            'quantity' => 1,
            'commission_amount' => $commission,
            'total_amount' => $winningPrice + $commission,
        ]);

        return [$auction->id, $auction];
    }
}
