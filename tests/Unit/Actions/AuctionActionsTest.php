<?php

namespace Tests\Unit\Actions;

use App\Actions\Auction\FinishAuctionAction;
use App\Actions\Auction\MoveToNextItemAction;
use App\Actions\Auction\PauseAuctionAction;
use App\Actions\Auction\ResumeAuctionAction;
use App\Actions\Auction\StartAuctionAction;
use App\Actions\Auction\ToggleEntranceAction;
use App\Actions\Auction\UpdateAuctionStatusAction;
use App\Actions\Auction\UpdateLaneCountAction;
use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Auction Actions の execute() 系の網羅テスト。
 *
 * - Start/Pause/Resume/Finish/MoveToNextItem/ToggleEntrance/UpdateStatus/UpdateLaneCount
 * - Archive/Unarchive はテスト DB が SQLite で MySQL 構文を使うため対象外。
 */
class AuctionActionsTest extends TestCase
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
        Queue::fake();
    }

    private function makeScheduledAuction(int $laneCount = 1): Auction
    {
        $auction = Auction::factory()->scheduled()->create([
            'created_by' => $this->admin->id,
            'lane_count' => $laneCount,
        ]);
        Item::factory()->registered()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        return $auction;
    }

    private function makeLiveAuction(): Auction
    {
        $auction = Auction::factory()->live()->create(['created_by' => $this->admin->id]);
        $lane = Lane::factory()->active()->create(['auction_id' => $auction->id]);
        $item = Item::factory()->live()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        $lane->update(['current_item_id' => $item->id]);
        return $auction;
    }

    public function test_StartAuctionAction_sets_status_to_live(): void
    {
        $auction = $this->makeScheduledAuction();

        app(StartAuctionAction::class)->execute($auction->fresh());

        $this->assertSame('live', $auction->fresh()->status);
    }

    public function test_StartAuctionAction_throws_for_non_scheduled(): void
    {
        $auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        $this->expectException(\RuntimeException::class);
        app(StartAuctionAction::class)->execute($auction);
    }

    public function test_PauseAuctionAction_marks_lanes_paused(): void
    {
        $auction = $this->makeLiveAuction();

        $result = app(PauseAuctionAction::class)->execute($auction->fresh());

        $this->assertTrue($result->success);
        $this->assertTrue($auction->lanes()->where('status', 'paused')->exists());
    }

    public function test_PauseAuctionAction_fails_for_non_live(): void
    {
        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
        $result = app(PauseAuctionAction::class)->execute($auction);
        $this->assertFalse($result->success);
    }

    public function test_ResumeAuctionAction_reactivates_paused_lanes(): void
    {
        $auction = $this->makeLiveAuction();
        // pause first
        app(PauseAuctionAction::class)->execute($auction->fresh());

        $result = app(ResumeAuctionAction::class)->execute($auction->fresh());
        $this->assertTrue($result->success);
        $this->assertFalse($auction->lanes()->where('status', 'paused')->exists());
    }

    public function test_ResumeAuctionAction_fails_for_non_live(): void
    {
        $auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        $result = app(ResumeAuctionAction::class)->execute($auction);
        $this->assertFalse($result->success);
    }

    public function test_FinishAuctionAction_finishes_live_and_calculates_shipping(): void
    {
        $auction = $this->makeLiveAuction();

        $result = app(FinishAuctionAction::class)->execute($auction->fresh());

        $this->assertTrue($result->success);
        $auction->refresh();
        $this->assertSame('finished', $auction->status);
        $this->assertNotNull($auction->end_time);
    }

    public function test_FinishAuctionAction_fails_for_non_live(): void
    {
        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
        $result = app(FinishAuctionAction::class)->execute($auction);
        $this->assertFalse($result->success);
    }

    public function test_FinishAuctionAction_calculateShippingForAuction_handles_winners(): void
    {
        $auction = $this->makeLiveAuction();
        $winner = $this->createParticipant();
        $item = $auction->items()->first();
        WonItem::factory()->create([
            'item_id' => $item->id,
            'winner_id' => $winner->id,
            'shipping_prefecture' => '東京都',
            'shipping_approved_at' => null,
            'quantity' => 5,
        ]);

        $action = app(FinishAuctionAction::class);
        $action->calculateShippingForAuction($auction->fresh());

        $w = WonItem::where('winner_id', $winner->id)->first();
        $this->assertNotNull($w->shipping_calculated_at);
    }

    public function test_FinishAuction_skips_already_approved_won_items(): void
    {
        $auction = $this->makeLiveAuction();
        $winner = $this->createParticipant();
        $item = $auction->items()->first();
        $approved = WonItem::factory()->create([
            'item_id' => $item->id,
            'winner_id' => $winner->id,
            'shipping_prefecture' => '東京都',
            'shipping_approved_at' => now(),
            'shipping_fee' => 9999,
            'quantity' => 1,
        ]);

        app(FinishAuctionAction::class)->calculateShippingForAuction($auction->fresh());

        // 承認済みは shipping_fee が変わらない
        $this->assertSame(9999, (int) $approved->fresh()->shipping_fee);
    }

    public function test_ToggleEntranceAction_opens_for_scheduled(): void
    {
        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);

        $result = app(ToggleEntranceAction::class)->execute($auction, true);
        $this->assertTrue($result->success);
    }

    public function test_ToggleEntranceAction_closes_for_scheduled(): void
    {
        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);

        $result = app(ToggleEntranceAction::class)->execute($auction, false);
        $this->assertTrue($result->success);
    }

    public function test_ToggleEntranceAction_fails_for_non_scheduled(): void
    {
        $auction = Auction::factory()->live()->create(['created_by' => $this->admin->id]);
        $result = app(ToggleEntranceAction::class)->execute($auction, true);
        $this->assertFalse($result->success);
    }

    public function test_MoveToNextItemAction_advances_to_next(): void
    {
        $auction = Auction::factory()->live()->create(['created_by' => $this->admin->id]);
        $lane = Lane::factory()->create(['auction_id' => $auction->id, 'status' => 'active']);
        $items = Item::factory()->count(2)->registered()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        // pivot 順序を入れる
        foreach ($items as $i => $item) {
            $lane->items()->attach($item->id, ['sequence_order' => $i + 1]);
        }
        $lane->update(['current_item_id' => $items->first()->id]);
        $items->first()->update(['status' => 'live']);

        $result = app(MoveToNextItemAction::class)->execute($lane->fresh(['currentItem']));
        $this->assertTrue($result->success);
    }

    public function test_UpdateAuctionStatusAction_transitions_status(): void
    {
        $auction = Auction::factory()->preparing()->create(['created_by' => $this->admin->id]);

        $result = app(UpdateAuctionStatusAction::class)->execute($auction, 'scheduled');
        $this->assertTrue($result->success);
        $this->assertSame('scheduled', $auction->fresh()->status);
    }

    public function test_UpdateLaneCountAction_changes_lane_count(): void
    {
        $auction = Auction::factory()->preparing()->create(['created_by' => $this->admin->id, 'lane_count' => 1]);
        Lane::factory()->create(['auction_id' => $auction->id, 'lane_number' => 1]);

        $result = app(UpdateLaneCountAction::class)->execute($auction->fresh(), 3);
        $this->assertTrue($result->success);
        $this->assertSame(3, (int) $auction->fresh()->lane_count);
        $this->assertSame(3, $auction->lanes()->count());
    }
}
