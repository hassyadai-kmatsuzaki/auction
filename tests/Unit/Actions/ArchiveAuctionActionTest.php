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
 * ArchiveAuctionAction / UnarchiveAuctionAction の追加 Unit テスト。
 *
 * ArchiveAuctionActionsTest が基本フローをカバーしているため、
 * ここでは戻り値構造・dry_run の DB 保護・力技モード・複数テーブル対応など
 * 追加の保証ケースを検証する。
 */
class ArchiveAuctionActionTest extends TestCase
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

    private function makeFinishedAuctionWithLaneItem(): array
    {
        $auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        $item = Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'status' => 'sold',
        ]);
        $lane = Lane::factory()->create(['auction_id' => $auction->id]);
        DB::table('lane_items')->insert([
            'lane_id' => $lane->id,
            'item_id' => $item->id,
            'sequence_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return [$auction, $item, $lane];
    }

    public function test_archive_の戻り値は規定キーを必ず含む(): void
    {
        $auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);

        $result = app(ArchiveAuctionAction::class)->execute($auction);

        $this->assertArrayHasKey('success', $result);
        $this->assertArrayHasKey('message', $result);
        $this->assertArrayHasKey('counts', $result);
        $this->assertArrayHasKey('dry_run', $result);
    }

    public function test_archive_dryRunで監査ログが書かれない(): void
    {
        [$auction] = $this->makeFinishedAuctionWithLaneItem();

        app(ArchiveAuctionAction::class)->execute($auction, ['dry_run' => true]);

        $this->assertDatabaseMissing('auction_archive_logs', [
            'auction_id' => $auction->id,
        ]);
    }

    public function test_archive_force_オプションでlive状態でも実行できる(): void
    {
        $auction = Auction::factory()->live()->create(['created_by' => $this->admin->id]);

        $result = app(ArchiveAuctionAction::class)->execute($auction, ['force' => true]);

        $this->assertTrue($result['success']);
    }

    public function test_archive_は_複数lane_itemsを正しく退避する(): void
    {
        $auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        $lane = Lane::factory()->create(['auction_id' => $auction->id]);
        for ($i = 1; $i <= 3; $i++) {
            $item = Item::factory()->create([
                'auction_id' => $auction->id,
                'seller_profile_id' => $this->sellerProfile->id,
                'status' => 'sold',
            ]);
            DB::table('lane_items')->insert([
                'lane_id' => $lane->id,
                'item_id' => $item->id,
                'sequence_order' => $i,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $result = app(ArchiveAuctionAction::class)->execute($auction);

        $this->assertTrue($result['success']);
        $this->assertSame(3, (int) $result['counts']['lane_items']);
        $this->assertSame(0, DB::table('lane_items')->count());
        $this->assertSame(3, DB::table('lane_items_archive')->count());
    }

    public function test_unarchive_監査ログレコードに件数が記録される(): void
    {
        [$auction] = $this->makeFinishedAuctionWithLaneItem();
        app(ArchiveAuctionAction::class)->execute($auction);

        app(UnarchiveAuctionAction::class)->execute($auction->id, [
            'executed_by' => $this->admin->id,
        ]);

        $this->assertDatabaseHas('auction_archive_logs', [
            'auction_id' => $auction->id,
            'operation' => 'unarchive',
            'lane_items_count' => 1,
            'executed_by' => $this->admin->id,
        ]);
    }

    public function test_archive_force_で再アーカイブが実行できる(): void
    {
        [$auction] = $this->makeFinishedAuctionWithLaneItem();

        app(ArchiveAuctionAction::class)->execute($auction);
        // 同じ auction に対して force 再実行は 0 件で問題なく success になる
        $result = app(ArchiveAuctionAction::class)->execute($auction, ['force' => true]);

        $this->assertTrue($result['success']);
    }
}
