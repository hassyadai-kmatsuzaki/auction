<?php

namespace Tests\Unit\Actions;

use App\Actions\Bid\JoinBidAction;
use App\Models\Auction;
use App\Models\BidParticipant;
use App\Models\Item;
use App\Models\Lane;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class JoinBidActionTest extends TestCase
{
    use RefreshDatabase;

    private JoinBidAction $action;

    protected function setUp(): void
    {
        parent::setUp();
        $this->action = app(JoinBidAction::class);
    }

    /** @test */
    public function test_ライブ中の商品に入札参加できる(): void
    {
        $auction     = Auction::factory()->create(['status' => 'live']);
        $item        = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);
        $userId      = 1;

        $result = $this->action->execute($item, $userId);

        $this->assertTrue($result->success);
        $this->assertDatabaseHas('bid_participants', [
            'item_id'   => $item->id,
            'user_id'   => $userId,
            'is_active' => true,
        ]);
    }

    /** @test */
    public function test_ライブでない商品には入札参加できない(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'sold']);

        $result = $this->action->execute($item, 1);

        $this->assertFalse($result->success);
        $this->assertStringContainsString('入札を受け付けていません', $result->message);
    }

    /** @test */
    public function test_オークションがライブでない場合は入札参加できない(): void
    {
        $auction = Auction::factory()->create(['status' => 'scheduled']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);

        $result = $this->action->execute($item, 1);

        $this->assertFalse($result->success);
        $this->assertStringContainsString('開催中ではありません', $result->message);
    }

    /** @test */
    public function test_pre_bidフェーズ中は入札参加できない(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);
        $lane    = Lane::factory()->create(['auction_id' => $auction->id, 'current_item_id' => $item->id]);

        Cache::put("countdown:lane:{$lane->id}", [
            'phase'             => 'pre_bid',
            'remaining_seconds' => 3.0,
            'is_running'        => true,
        ], 60);

        $result = $this->action->execute($item, 1);

        $this->assertFalse($result->success);
        $this->assertStringContainsString('入札開始待機中', $result->message);
    }
}
