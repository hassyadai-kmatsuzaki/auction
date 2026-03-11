<?php

namespace Tests\Unit\Actions;

use App\Actions\Bid\LeaveBidAction;
use App\Models\Auction;
use App\Models\BidParticipant;
use App\Models\Item;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeaveBidActionTest extends TestCase
{
    use RefreshDatabase;

    private LeaveBidAction $action;

    protected function setUp(): void
    {
        parent::setUp();
        $this->action = app(LeaveBidAction::class);
    }

    /** @test */
    public function test_正常に入札離脱できる(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);
        $userId1 = 1;
        $userId2 = 2;

        // 2人の入札者を作成（1人だけだと最高入札者で離脱できない）
        BidParticipant::create([
            'item_id'    => $item->id,
            'user_id'    => $userId1,
            'is_active'  => true,
            'activated_at' => now(),
        ]);

        BidParticipant::create([
            'item_id'    => $item->id,
            'user_id'    => $userId2,
            'is_active'  => true,
            'activated_at' => now(),
        ]);

        $result = $this->action->execute($item, $userId1);

        $this->assertTrue($result->success);
        $this->assertDatabaseHas('bid_participants', [
            'item_id'   => $item->id,
            'user_id'   => $userId1,
            'is_active' => false,
        ]);
    }

    /** @test */
    public function test_入札していない商品から離脱しようとするとエラー(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);

        $result = $this->action->execute($item, 99);

        $this->assertFalse($result->success);
        $this->assertStringContainsString('参加していません', $result->message);
    }

    /** @test */
    public function test_ライブでない商品から離脱しようとするとエラー(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'sold']);

        $result = $this->action->execute($item, 1);

        $this->assertFalse($result->success);
    }

    /** @test */
    public function test_すでに離脱済みの参加者は再離脱できない(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);
        $userId  = 1;

        BidParticipant::create([
            'item_id'   => $item->id,
            'user_id'   => $userId,
            'is_active' => false,
        ]);

        $result = $this->action->execute($item, $userId);

        $this->assertFalse($result->success);
    }

    /** @test */
    public function test_最高入札者は入札を解除できない(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);
        $userId  = 1;

        // 1人だけの入札者（最高入札者）
        BidParticipant::create([
            'item_id'    => $item->id,
            'user_id'    => $userId,
            'is_active'  => true,
            'activated_at' => now(),
        ]);

        $result = $this->action->execute($item, $userId);

        $this->assertFalse($result->success);
        $this->assertStringContainsString('最高入札者は入札を解除できません', $result->message);
        
        // データベースには変更がないことを確認
        $this->assertDatabaseHas('bid_participants', [
            'item_id'   => $item->id,
            'user_id'   => $userId,
            'is_active' => true,
        ]);
    }
}
