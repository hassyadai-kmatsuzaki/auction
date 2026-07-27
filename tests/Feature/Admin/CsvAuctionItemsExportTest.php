<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

/**
 * 出品生体明細CSVの金額列（落札者/出品者手数料・消費税3区分・請求/支払合計）を検証する。
 *
 * - 消費税(インボイス有出品者)/(インボイス無出品者) は該当区分のみに出力（他方は空欄）
 * - 丸めは生体単位で floor（帳票単位で丸めるサマリーCSVとは合計が一致しない場合がある）
 * - 未落札の行は金額列すべて空欄
 */
class CsvAuctionItemsExportTest extends TestCase
{
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
    }

    public function test_item_csv_outputs_tax_three_way_only_in_applicable_column(): void
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

        // 行順を固定するため item_number を明示
        $itemA = Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $registeredSeller->id,
            'status' => 'sold',
            'item_number' => 1,
        ]);
        $itemB = Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $exemptSeller->id,
            'status' => 'sold',
            'item_number' => 2,
        ]);
        // 未落札の生体（金額列は全て空欄）
        Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $registeredSeller->id,
            'status' => 'unsold',
            'item_number' => 3,
        ]);

        // インボイス有出品者の商品: 落札 100,000 / 手数料 10,000 / 送料 2,000
        WonItem::factory()->create([
            'item_id' => $itemA->id,
            'winner_id' => $this->createParticipant()->id,
            'winning_price' => 100000,
            'quantity' => 1,
            'commission_amount' => 10000,
            'shipping_fee' => 2000,
        ]);
        // インボイス無出品者の商品: 落札 50,000 / 手数料 5,000 / 送料 1,000
        WonItem::factory()->create([
            'item_id' => $itemB->id,
            'winner_id' => $this->createParticipant()->id,
            'winning_price' => 50000,
            'quantity' => 1,
            'commission_amount' => 5000,
            'shipping_fee' => 1000,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->get('/api/admin/exports/auction-items.csv?auction_id=' . $auction->id);

        $response->assertOk();

        $content = preg_replace('/^\xEF\xBB\xBF/', '', $response->streamedContent());
        $lines = array_values(array_filter(explode("\n", trim($content))));
        $this->assertCount(4, $lines); // ヘッダー + 3生体

        $header = str_getcsv($lines[0]);
        $rowA = array_combine($header, str_getcsv($lines[1]));
        $rowB = array_combine($header, str_getcsv($lines[2]));
        $rowC = array_combine($header, str_getcsv($lines[3]));

        // --- インボイス有出品者の行 ---
        $this->assertSame('100000', $rowA['落札金額(税抜)']);
        $this->assertSame('10000', $rowA['落札者手数料(税抜)']);
        $this->assertSame('10000', $rowA['出品者手数料(税抜)']);
        $this->assertSame('2000', $rowA['送料(税抜)']);
        // 落札者: (100,000+10,000+2,000)×10% = 11,200
        $this->assertSame('11200', $rowA['消費税(落札者)']);
        // インボイス有: 100,000×10% − 10,000×10% = 9,000。無の列は空欄
        $this->assertSame('9000', $rowA['消費税(インボイス有出品者)']);
        $this->assertSame('', $rowA['消費税(インボイス無出品者)']);
        $this->assertSame('123200', $rowA['落札者請求合計(税込)']);
        // (100,000+10,000) − (10,000+1,000) = 99,000
        $this->assertSame('99000', $rowA['出品者支払合計(税込)']);

        // --- インボイス無出品者の行 ---
        $this->assertSame('50000', $rowB['落札金額(税抜)']);
        // 落札者: (50,000+5,000+1,000)×10% = 5,600
        $this->assertSame('5600', $rowB['消費税(落札者)']);
        // インボイス無: 50,000×8% − 5,000×10% = 3,500。有の列は空欄
        $this->assertSame('', $rowB['消費税(インボイス有出品者)']);
        $this->assertSame('3500', $rowB['消費税(インボイス無出品者)']);
        $this->assertSame('61600', $rowB['落札者請求合計(税込)']);
        // (50,000+4,000) − (5,000+500) = 48,500
        $this->assertSame('48500', $rowB['出品者支払合計(税込)']);

        // --- 未落札の行は金額列すべて空欄 ---
        foreach ([
            '落札金額(税抜)', '落札者手数料(税抜)', '出品者手数料(税抜)', '送料(税抜)',
            '消費税(落札者)', '消費税(インボイス有出品者)', '消費税(インボイス無出品者)',
            '落札者請求合計(税込)', '出品者支払合計(税込)',
        ] as $col) {
            $this->assertSame('', $rowC[$col], "未落札行の {$col} は空欄であるべき");
        }
    }
}
