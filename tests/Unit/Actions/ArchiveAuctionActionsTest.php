<?php

namespace Tests\Unit\Actions;

use App\Actions\Auction\ArchiveAuctionAction;
use App\Actions\Auction\UnarchiveAuctionAction;
use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * ArchiveAuctionAction / UnarchiveAuctionAction の Unit テスト。
 *
 * 実体は INSERT ... SELECT を生 SQL で発行する。SQLite はバッククォートを
 * 識別子として無視するため SQL 自体は実行可能。
 *
 * 検証スコープ:
 *   - 状態チェック（status / 既アーカイブ / dry-run）
 *   - 衝突検知
 *   - 監査ログ書き込み
 */
class ArchiveAuctionActionsTest extends TestCase
{
    private User $admin;
    private SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
    }

    private function makeFinishedAuction(): Auction
    {
        $auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        $item = Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'status' => 'sold',
        ]);
        return $auction;
    }

    public function test_archive_は_finished以外で失敗を返す(): void
    {
        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);

        $result = app(ArchiveAuctionAction::class)->execute($auction);
        $this->assertFalse($result['success']);
        $this->assertStringContainsString('finished', $result['message']);
    }

    public function test_archive_force_オプションで非finishedも処理対象になる(): void
    {
        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);

        // dry_run + force で件数算出のみ
        $result = app(ArchiveAuctionAction::class)->execute($auction, [
            'force' => true,
            'dry_run' => true,
        ]);
        // items が無いので即success
        $this->assertTrue($result['success']);
    }

    public function test_archive_は_対象アイテム0件でskipメッセージを返す(): void
    {
        $auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);

        $result = app(ArchiveAuctionAction::class)->execute($auction);
        $this->assertTrue($result['success']);
        $this->assertStringContainsString('スキップ', $result['message']);
    }

    public function test_archive_dryRunは_count_配列のみ返してDBを変更しない(): void
    {
        $auction = $this->makeFinishedAuction();
        $item = $auction->items->first();
        $lane = Lane::factory()->create(['auction_id' => $auction->id]);
        DB::table('lane_items')->insert([
            'lane_id' => $lane->id,
            'item_id' => $item->id,
            'sequence_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $result = app(ArchiveAuctionAction::class)->execute($auction, ['dry_run' => true]);
        $this->assertTrue($result['success']);
        $this->assertTrue($result['dry_run']);
        $this->assertSame(1, (int) $result['counts']['lane_items']);
        // DBは変わらず
        $this->assertSame(1, DB::table('lane_items')->count());
        $this->assertSame(0, DB::table('lane_items_archive')->count());
    }

    public function test_archive_は_lane_itemsを退避してauction_archive_logsを書く(): void
    {
        $auction = $this->makeFinishedAuction();
        $item = $auction->items->first();
        $lane = Lane::factory()->create(['auction_id' => $auction->id]);
        DB::table('lane_items')->insert([
            'lane_id' => $lane->id,
            'item_id' => $item->id,
            'sequence_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $result = app(ArchiveAuctionAction::class)->execute($auction, [
            'executed_by' => $this->admin->id,
            'note' => 'テスト退避',
        ]);
        $this->assertTrue($result['success']);
        $this->assertSame(0, DB::table('lane_items')->count(), '本番テーブルから消える');
        $this->assertSame(1, DB::table('lane_items_archive')->count(), 'アーカイブに退避');
        $this->assertDatabaseHas('auction_archive_logs', [
            'auction_id' => $auction->id,
            'operation' => 'archive',
            'lane_items_count' => 1,
            'executed_by' => $this->admin->id,
            'note' => 'テスト退避',
        ]);
    }

    public function test_archive_は_既アーカイブ済みでforce無しなら失敗を返す(): void
    {
        $auction = $this->makeFinishedAuction();
        DB::table('auction_archive_logs')->insert([
            'auction_id' => $auction->id,
            'operation' => 'archive',
            'executed_at' => now(),
        ]);

        $result = app(ArchiveAuctionAction::class)->execute($auction);
        $this->assertFalse($result['success']);
        $this->assertStringContainsString('既にアーカイブ', $result['message']);
    }

    public function test_unarchive_は_アーカイブデータなしでfalse(): void
    {
        $auction = $this->makeFinishedAuction();

        $result = app(UnarchiveAuctionAction::class)->execute($auction->id);
        $this->assertFalse($result['success']);
        $this->assertStringContainsString('見つかりません', $result['message']);
    }

    public function test_archive_unarchiveの往復で件数が一致する(): void
    {
        $auction = $this->makeFinishedAuction();
        $item = $auction->items->first();
        $lane = Lane::factory()->create(['auction_id' => $auction->id]);
        DB::table('lane_items')->insert([
            'lane_id' => $lane->id,
            'item_id' => $item->id,
            'sequence_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // archive
        app(ArchiveAuctionAction::class)->execute($auction);
        $this->assertSame(0, DB::table('lane_items')->count());
        $this->assertSame(1, DB::table('lane_items_archive')->count());

        // unarchive
        $result = app(UnarchiveAuctionAction::class)->execute($auction->id, [
            'executed_by' => $this->admin->id,
            'note' => '巻き戻し',
        ]);
        $this->assertTrue($result['success']);
        $this->assertSame(1, DB::table('lane_items')->count(), '本番テーブルに戻る');
        $this->assertSame(0, DB::table('lane_items_archive')->count(), 'アーカイブから消える');
        $this->assertDatabaseHas('auction_archive_logs', [
            'auction_id' => $auction->id,
            'operation' => 'unarchive',
        ]);
    }

    public function test_unarchive_は_本番に同IDがあれば衝突として失敗(): void
    {
        $auction = $this->makeFinishedAuction();
        $item = $auction->items->first();
        $lane = Lane::factory()->create(['auction_id' => $auction->id]);
        DB::table('lane_items')->insert([
            'lane_id' => $lane->id,
            'item_id' => $item->id,
            'sequence_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // archive 後
        app(ArchiveAuctionAction::class)->execute($auction);

        // 同じ item_id で本番側にレコードを再投入（巻き戻し前に出品が動いたケース）
        DB::table('lane_items')->insert([
            'id' => 9999,
            'lane_id' => $lane->id,
            'item_id' => $item->id,
            'sequence_order' => 2,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $result = app(UnarchiveAuctionAction::class)->execute($auction->id);
        $this->assertFalse($result['success']);
        $this->assertStringContainsString('既存', $result['message']);
    }
}
