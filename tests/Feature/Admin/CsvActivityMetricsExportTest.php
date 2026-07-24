<?php

namespace Tests\Feature\Admin;

use App\Models\ActivityEvent;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use Tests\TestCase;

/**
 * オークション一覧サマリー / 出品生体明細 CSV に追加した行動分析列
 * （閲覧数 / 閲覧UU / お気に入り数 / 指値数）の集計を検証する。
 *
 * - 閲覧数/閲覧UU … item_view の件数と distinct ユーザー数
 * - お気に入り数   … favorite_add の累計件数
 * - 指値数         … bid_limit_set の累計件数
 * - is_test ユーザーの行動は全指標から除外される
 */
class CsvActivityMetricsExportTest extends TestCase
{
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
    }

    private function event(string $type, int $userId, int $auctionId, ?int $itemId): void
    {
        ActivityEvent::create([
            'user_id'    => $userId,
            'auction_id' => $auctionId,
            'item_id'    => $itemId,
            'event_type' => $type,
            'event_date' => now()->toDateString(),
            'dedup_key'  => null,
        ]);
    }

    public function test_summary_and_item_csv_include_activity_metrics_excluding_test_users(): void
    {
        $auction = Auction::factory()->create([
            'event_date' => '2026-07-01',
            'status' => 'scheduled',
        ]);
        $seller = SellerProfile::factory()->create();
        $item = Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $seller->id,
            'status' => 'exhibited',
        ]);

        $userA = $this->createParticipant();
        $userB = $this->createParticipant();
        $testUser = User::factory()->create(['is_test' => true]);

        // 閲覧: 実ユーザー2名が同 item を閲覧（views=2, view_users=2）
        $this->event(ActivityEvent::ITEM_VIEW, $userA->id, $auction->id, $item->id);
        $this->event(ActivityEvent::ITEM_VIEW, $userB->id, $auction->id, $item->id);
        // お気に入り: userA が1件
        $this->event(ActivityEvent::FAVORITE_ADD, $userA->id, $auction->id, $item->id);
        // 指値: userA が1件
        $this->event(ActivityEvent::BID_LIMIT_SET, $userA->id, $auction->id, $item->id);

        // is_test ユーザーの行動は全て除外される
        $this->event(ActivityEvent::ITEM_VIEW, $testUser->id, $auction->id, $item->id);
        $this->event(ActivityEvent::FAVORITE_ADD, $testUser->id, $auction->id, $item->id);
        $this->event(ActivityEvent::BID_LIMIT_SET, $testUser->id, $auction->id, $item->id);

        // --- サマリーCSV（1行=1オークション） ---
        $summary = $this->actingAs($this->admin, 'sanctum')
            ->get('/api/admin/exports/auctions-summary.csv');
        $summary->assertOk();
        $srow = $this->firstDataRow($summary->streamedContent());

        $this->assertSame('2', $srow['閲覧数']);
        $this->assertSame('2', $srow['閲覧UU']);
        $this->assertSame('1', $srow['お気に入り数']);
        $this->assertSame('1', $srow['指値数']);

        // --- 出品生体明細CSV（1行=1生体） ---
        $items = $this->actingAs($this->admin, 'sanctum')
            ->get('/api/admin/exports/auction-items.csv?auction_id=' . $auction->id);
        $items->assertOk();
        $irow = $this->firstDataRow($items->streamedContent());

        $this->assertSame('2', $irow['閲覧数']);
        $this->assertSame('2', $irow['閲覧UU']);
        $this->assertSame('1', $irow['お気に入り数']);
        $this->assertSame('1', $irow['指値数']);
    }

    /** BOM を除去し、ヘッダーと1行目のデータを連想配列にして返す。 */
    private function firstDataRow(string $content): array
    {
        $content = preg_replace('/^\xEF\xBB\xBF/', '', $content);
        $lines = array_values(array_filter(explode("\n", trim($content))));
        $header = str_getcsv($lines[0]);
        return array_combine($header, str_getcsv($lines[1]));
    }
}
