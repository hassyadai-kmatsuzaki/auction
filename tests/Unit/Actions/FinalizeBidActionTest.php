<?php

namespace Tests\Unit\Actions;

use App\Actions\Bid\FinalizeBidAction;
use App\Models\Auction;
use App\Models\BidParticipant;
use App\Models\Item;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FinalizeBidActionTest extends TestCase
{
    use RefreshDatabase;

    private FinalizeBidAction $action;

    protected function setUp(): void
    {
        parent::setUp();
        $this->action = app(FinalizeBidAction::class);
    }

    /** @test */
    public function test_入札者1人の場合は落札確定する(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create([
            'auction_id'    => $auction->id,
            'status'        => 'live',
            'current_price' => 5000,
            'quantity'      => 1,
        ]);
        $user = User::factory()->create();

        BidParticipant::create([
            'item_id'   => $item->id,
            'user_id'   => $user->id,
            'is_active' => true,
        ]);

        $result = $this->action->execute($item);

        $this->assertTrue($result->success);
        $this->assertDatabaseHas('items',     ['id' => $item->id, 'status' => 'sold']);
        $this->assertDatabaseHas('won_items', ['item_id' => $item->id, 'winner_id' => $user->id]);
    }

    /** @test */
    public function test_入札者0人の場合は不成立になる(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);

        $result = $this->action->execute($item);

        $this->assertTrue($result->success);
        $this->assertDatabaseHas('items', ['id' => $item->id, 'status' => 'unsold']);
    }

    /** @test */
    public function test_入札者2人以上の場合はエラーを返す(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);

        $users = User::factory(2)->create();
        foreach ($users as $user) {
            BidParticipant::create(['item_id' => $item->id, 'user_id' => $user->id, 'is_active' => true]);
        }

        $result = $this->action->execute($item);

        $this->assertFalse($result->success);
        $this->assertStringContainsString('複数の入札者', $result->message);
    }

    /** @test */
    public function test_ライブでない商品は処理できない(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'sold']);

        $result = $this->action->execute($item);

        $this->assertFalse($result->success);
    }
}
