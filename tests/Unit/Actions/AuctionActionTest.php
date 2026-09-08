<?php

namespace Tests\Unit\Actions;

use App\Actions\Auction\FinishAuctionAction;
use App\Actions\Auction\PauseAuctionAction;
use App\Actions\Auction\ResumeAuctionAction;
use App\Actions\Auction\UpdateLaneCountAction;
use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuctionActionTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function test_FinishAction_開催中のオークションを終了できる(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        Lane::factory()->create(['auction_id' => $auction->id, 'status' => 'active']);
        Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);

        $result = app(FinishAuctionAction::class)->execute($auction);

        $this->assertTrue($result->success);
        $this->assertDatabaseHas('auctions', ['id' => $auction->id, 'status' => 'finished']);
        $this->assertDatabaseMissing('items', ['auction_id' => $auction->id, 'status' => 'live']);
    }

    /** @test */
    public function test_FinishAction_開催中でないオークションは終了できない(): void
    {
        $auction = Auction::factory()->create(['status' => 'scheduled']);

        $result = app(FinishAuctionAction::class)->execute($auction);

        $this->assertFalse($result->success);
    }

    /** @test */
    public function test_PauseAction_開催中のオークションを一時停止できる(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        Lane::factory()->create(['auction_id' => $auction->id, 'status' => 'active']);

        $result = app(PauseAuctionAction::class)->execute($auction);

        $this->assertTrue($result->success);
        $this->assertDatabaseHas('lanes', ['auction_id' => $auction->id, 'status' => 'paused']);
    }

    /** @test */
    public function test_UpdateLaneCountAction_レーン数を増やせる(): void
    {
        $auction = Auction::factory()->create(['status' => 'preparing', 'lane_count' => 3]);
        // LaneFactory の lane_number は乱数なので (auction_id, lane_number) の UNIQUE に当たる。
        // 明示的に 1..3 を振る（A-10 / 2026-09-08）。
        Lane::factory()->count(3)
            ->sequence(fn ($seq) => ['lane_number' => $seq->index + 1])
            ->create(['auction_id' => $auction->id]);

        $result = app(UpdateLaneCountAction::class)->execute($auction, 5);

        $this->assertTrue($result->success);
        $this->assertDatabaseHas('auctions', ['id' => $auction->id, 'lane_count' => 5]);
        $this->assertDatabaseCount('lanes', 5);
    }

    /** @test */
    public function test_UpdateLaneCountAction_開催中は変更不可(): void
    {
        $auction = Auction::factory()->create(['status' => 'live', 'lane_count' => 3]);

        $result = app(UpdateLaneCountAction::class)->execute($auction, 5);

        $this->assertFalse($result->success);
    }
}
