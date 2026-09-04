<?php

namespace Tests\Unit\Mail;

use App\Mail\PaymentConfirmedMail;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

/**
 * 入金確認メールの金額表示。
 *
 * 入金済みの案内なので「お支払い金額合計」は実際に支払われた税込額でなければならない。
 * won_items.total_amount は税抜（手数料込）のため、請求書PDFと同じ
 * InvoiceService::buyerTotals で消費税を上乗せして表示する（2026-09-02 齟齬解消）。
 */
class PaymentConfirmedMailTest extends TestCase
{
    private User $winner;
    private SellerProfile $sellerProfile;
    private Auction $auction;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $admin = $this->createAdmin();
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $this->auction = Auction::factory()->finished()->create(['created_by' => $admin->id]);
        $this->winner = $this->createParticipant();
    }

    private function makeWonItem(string $speciesName, array $attrs): WonItem
    {
        $item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'species_name' => $speciesName,
        ]);

        return WonItem::factory()->create(array_merge([
            'item_id' => $item->id,
            'winner_id' => $this->winner->id,
            'payment_status' => 'confirmed',
        ], $attrs))->fresh(['item', 'winner']);
    }

    public function test_お支払い金額合計は税込で内訳を出す(): void
    {
        // 5000×3 + 手数料1500 = 16500、送料 1500
        $w1 = $this->makeWonItem('幹之メダカ', [
            'winning_price' => 5000, 'quantity' => 3, 'commission_amount' => 1500, 'total_amount' => 16500, 'shipping_fee' => 1500,
        ]);
        // 5000×2 + 手数料1000 = 11000、送料なし
        $this->makeWonItem('楊貴妃メダカ', [
            'winning_price' => 5000, 'quantity' => 2, 'commission_amount' => 1000, 'total_amount' => 11000, 'shipping_fee' => 0,
        ]);

        // Mailable は auction × winner の全落札品を自分で集約する
        $html = (new PaymentConfirmedMail($w1))->render();

        $this->assertStringContainsString('幹之メダカ', $html);
        $this->assertStringContainsString('楊貴妃メダカ', $html);
        $this->assertStringContainsString('¥16,500', $html);
        $this->assertStringContainsString('¥11,000', $html);
        $this->assertStringContainsString('商品代金（税抜・落札手数料込）', $html);
        $this->assertStringContainsString('¥27,500', $html);
        $this->assertStringContainsString('配送料金', $html);
        $this->assertStringContainsString('¥1,500', $html);
        // (16500 + 11000 + 1500) = 29000 → 税 2900 → 31900
        $this->assertStringContainsString('消費税（10%）', $html);
        $this->assertStringContainsString('¥2,900', $html);
        $this->assertStringContainsString('お支払い金額合計（税込）', $html);
        $this->assertStringContainsString('¥31,900', $html);
        // 税抜合計を「お支払い金額」として出さない
        $this->assertStringNotContainsString('¥29,000', $html);
    }

    public function test_送料ゼロなら配送料金行を出さない(): void
    {
        $w = $this->makeWonItem('幹之メダカ', [
            'winning_price' => 1000, 'quantity' => 1, 'commission_amount' => 100, 'total_amount' => 1100, 'shipping_fee' => 0,
        ]);

        $html = (new PaymentConfirmedMail($w))->render();

        $this->assertStringNotContainsString('配送料金', $html);
        // 1100 → 税 110 → 1210
        $this->assertStringContainsString('¥110', $html);
        $this->assertStringContainsString('¥1,210', $html);
    }
}
