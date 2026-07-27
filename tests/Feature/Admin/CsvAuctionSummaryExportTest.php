<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

/**
 * オークション一覧サマリーCSVの消費税3区分（落札者 / インボイス有出品者 / インボイス無出品者）
 * が帳票（請求書・支払通知書）と同じ丸め単位で集計されることを検証する。
 */
class CsvAuctionSummaryExportTest extends TestCase
{
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
    }

    public function test_summary_csv_splits_tax_into_three_patterns(): void
    {
        // 経過措置 80% 期間内（免税出品者の落札金額は 8%）
        $auction = Auction::factory()->create([
            'event_date' => '2026-07-01',
            'status' => 'finished',
        ]);

        $registeredSeller = SellerProfile::factory()->create([
            'business_registration_number' => 'T1234567890123',
        ]);
        $exemptSeller = SellerProfile::factory()->create([
            'business_registration_number' => null,
        ]);

        $itemA = Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $registeredSeller->id,
            'status' => 'sold',
        ]);
        $itemB = Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $exemptSeller->id,
            'status' => 'sold',
        ]);

        $winner1 = $this->createParticipant();
        $winner2 = $this->createParticipant();

        // インボイス有出品者の商品: 落札 100,000 / 手数料 10,000 / 送料 2,000
        WonItem::factory()->create([
            'item_id' => $itemA->id,
            'winner_id' => $winner1->id,
            'winning_price' => 100000,
            'quantity' => 1,
            'commission_amount' => 10000,
            'shipping_fee' => 2000,
        ]);
        // インボイス無出品者の商品: 落札 50,000 / 手数料 5,000 / 送料 1,000
        WonItem::factory()->create([
            'item_id' => $itemB->id,
            'winner_id' => $winner2->id,
            'winning_price' => 50000,
            'quantity' => 1,
            'commission_amount' => 5000,
            'shipping_fee' => 1000,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->get('/api/admin/exports/auctions-summary.csv');

        $response->assertOk();

        $content = preg_replace('/^\xEF\xBB\xBF/', '', $response->streamedContent());
        $lines = array_values(array_filter(explode("\n", trim($content))));
        $this->assertCount(2, $lines);

        $header = str_getcsv($lines[0]);
        $row = array_combine($header, str_getcsv($lines[1]));

        $this->assertSame('150000', $row['落札金額(税抜)']);
        $this->assertSame('15000', $row['落札者手数料(税抜)']);
        $this->assertSame('15000', $row['出品者手数料(税抜)']);
        $this->assertSame('3000', $row['送料(税抜)']);

        // 落札者: (100,000+10,000+2,000)×10% + (50,000+5,000+1,000)×10% = 11,200 + 5,600
        $this->assertSame('16800', $row['消費税(落札者)']);
        // インボイス有: 100,000×10% − 10,000×10% = 9,000
        $this->assertSame('9000', $row['消費税(インボイス有出品者)']);
        // インボイス無: 50,000×8% − 5,000×10% = 3,500
        $this->assertSame('3500', $row['消費税(インボイス無出品者)']);

        // 落札者請求合計: 123,200 + 61,600
        $this->assertSame('184800', $row['落札者請求合計(税込)']);
        // 出品者支払合計: (110,000−11,000) + (54,000−5,500) = 99,000 + 48,500
        $this->assertSame('147500', $row['出品者支払合計(税込)']);
    }

    public function test_exempt_rate_follows_transition_period_of_event_date(): void
    {
        // 2026-10-01 以降は経過措置 50%（免税出品者の落札金額は 5%）
        $auction = Auction::factory()->create([
            'event_date' => '2026-10-15',
            'status' => 'finished',
        ]);

        $exemptSeller = SellerProfile::factory()->create([
            'business_registration_number' => null,
        ]);
        $item = Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $exemptSeller->id,
            'status' => 'sold',
        ]);
        WonItem::factory()->create([
            'item_id' => $item->id,
            'winner_id' => $this->createParticipant()->id,
            'winning_price' => 100000,
            'quantity' => 1,
            'commission_amount' => 10000,
            'shipping_fee' => 0,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->get('/api/admin/exports/auctions-summary.csv');

        $response->assertOk();

        $content = preg_replace('/^\xEF\xBB\xBF/', '', $response->streamedContent());
        $lines = array_values(array_filter(explode("\n", trim($content))));
        $header = str_getcsv($lines[0]);
        $row = array_combine($header, str_getcsv($lines[1]));

        // 100,000×5% − 10,000×10% = 4,000
        $this->assertSame('4000', $row['消費税(インボイス無出品者)']);
        $this->assertSame('0', $row['消費税(インボイス有出品者)']);
    }
}
