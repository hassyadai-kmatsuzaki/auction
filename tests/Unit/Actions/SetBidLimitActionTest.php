<?php

namespace Tests\Unit\Actions;

use App\Actions\Bid\SetBidLimitAction;
use App\Models\Auction;
use App\Models\BidLimitPrice;
use App\Models\Favorite;
use App\Models\Item;
use Tests\TestCase;

class SetBidLimitActionTest extends TestCase
{
    private SetBidLimitAction $action;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->action = app(SetBidLimitAction::class);
    }

    public function test_指値設定時にお気に入りが自動追加される(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'registered', 'current_price' => 100]);
        $userId  = $this->createParticipant()->id;

        $result = $this->action->execute($item, $userId, 500);

        $this->assertTrue($result->success);
        $this->assertDatabaseHas('favorites', [
            'user_id' => $userId,
            'item_id' => $item->id,
        ]);
    }

    public function test_指値解除時にお気に入りも自動削除される(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'registered', 'current_price' => 100]);
        $userId  = $this->createParticipant()->id;

        $this->action->execute($item, $userId, 500);
        $this->assertDatabaseHas('favorites', ['user_id' => $userId, 'item_id' => $item->id]);

        $this->action->remove($item, $userId);

        $this->assertDatabaseMissing('favorites', [
            'user_id' => $userId,
            'item_id' => $item->id,
        ]);
        $this->assertDatabaseMissing('bid_limit_prices', [
            'user_id' => $userId,
            'item_id' => $item->id,
        ]);
    }

    public function test_指値設定で既存のお気に入りが重複しない(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'registered', 'current_price' => 100]);
        $userId  = $this->createParticipant()->id;

        Favorite::create(['user_id' => $userId, 'item_id' => $item->id]);

        $result = $this->action->execute($item, $userId, 500);

        $this->assertTrue($result->success);
        $this->assertEquals(1, Favorite::where('user_id', $userId)->where('item_id', $item->id)->count());
    }

    public function test_上限価格は1円以上必須(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live', 'current_price' => 100]);
        $userId  = $this->createParticipant()->id;

        $result = $this->action->execute($item, $userId, 0);

        $this->assertFalse($result->success);
    }
}
