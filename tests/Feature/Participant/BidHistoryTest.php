<?php

namespace Tests\Feature\Participant;

use App\Models\Auction;
use App\Models\BidEvent;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

/**
 * F-022 入札履歴
 */
class BidHistoryTest extends TestCase
{
    private User $me;
    private Auction $auction;
    private SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        config(['features.bid_history' => true]);
        $this->me = $this->createParticipant();
        $this->auction = Auction::factory()->finished()->create();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
    }

    private function item(string $status): Item
    {
        return Item::factory()->create(['auction_id' => $this->auction->id, 'seller_profile_id' => $this->sellerProfile->id, 'status' => $status, 'current_price' => 3000]);
    }

    private function join(Item $item, User $user, string $at): void
    {
        $e = BidEvent::create(['item_id' => $item->id, 'user_id' => $user->id, 'event_type' => BidEvent::TYPE_JOIN, 'price_at_event' => 1000]);
        $e->forceFill(['created_at' => $at])->save();
    }

    public function test_lists_my_bids_with_results_newest_first(): void
    {
        $other = $this->createParticipant();
        $won = $this->item('sold');
        $lost = $this->item('sold');
        $unsold = $this->item('unsold');
        $notMine = $this->item('sold');

        $this->join($won, $this->me, '2026-10-01 11:00:00');
        $this->join($won, $this->me, '2026-10-01 11:05:00'); // 同じ生体の再入札は1行にまとめる
        $this->join($lost, $this->me, '2026-10-01 12:00:00');
        $this->join($unsold, $this->me, '2026-10-01 10:00:00');
        $this->join($notMine, $other, '2026-10-01 12:30:00');
        WonItem::factory()->create(['item_id' => $won->id, 'winner_id' => $this->me->id, 'winning_price' => 5000]);
        WonItem::factory()->create(['item_id' => $lost->id, 'winner_id' => $other->id, 'winning_price' => 8000]);

        $rows = $this->actingAs($this->me, 'sanctum')->getJson('/api/participant/bid-history')
            ->assertOk()->json('data.history');

        $this->assertSame([$lost->id, $won->id, $unsold->id], array_column($rows, 'item_id'));
        $this->assertSame(['lost', 'won', 'unsold'], array_column($rows, 'result'));
        $this->assertSame(5000, $rows[1]['final_price']);
    }

    public function test_is_404_when_feature_is_off(): void
    {
        config(['features.bid_history' => false]);

        $this->actingAs($this->me, 'sanctum')->getJson('/api/participant/bid-history')->assertStatus(404);
    }
}
