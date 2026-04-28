<?php

namespace Tests\Unit\Console;

use App\Jobs\ProcessAuctionCountdownJob;
use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Services\CountdownService;
use Illuminate\Support\Facades\Bus;
use Mockery;
use Tests\TestCase;

class StartCountdownCommandTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Bus::fake();

        // CountdownService の副作用（Cache / Event / DB ロック）を遮断
        $mock = Mockery::mock(CountdownService::class);
        $mock->shouldReceive('stopCountdown')->byDefault();
        $mock->shouldReceive('startCountdown')->byDefault();
        $this->app->instance(CountdownService::class, $mock);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function makeLiveAuctionWithActiveLane(): array
    {
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);

        $auction = Auction::factory()->live()->create();
        $item = Item::factory()->live()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);
        $lane = Lane::factory()->active()->create([
            'auction_id' => $auction->id,
            'lane_number' => 1,
            'current_item_id' => $item->id,
        ]);

        return compact('auction', 'item', 'lane');
    }

    public function test_command_errors_when_no_live_auctions(): void
    {
        $this->artisan('countdown:start')
            ->expectsOutputToContain('No live auctions found')
            ->assertExitCode(1);
    }

    public function test_command_dispatches_countdown_job_for_live_auction(): void
    {
        $ctx = $this->makeLiveAuctionWithActiveLane();

        $this->artisan('countdown:start')
            ->expectsOutputToContain("Processing auction: {$ctx['auction']->id}")
            ->assertExitCode(0);

        Bus::assertDispatched(ProcessAuctionCountdownJob::class, function ($job) use ($ctx) {
            return $job->auctionId === $ctx['auction']->id;
        });
    }

    public function test_command_calls_countdown_service_for_active_lane(): void
    {
        $mock = Mockery::mock(CountdownService::class);
        $mock->shouldReceive('stopCountdown')->once();
        $mock->shouldReceive('startCountdown')->once();
        $this->app->instance(CountdownService::class, $mock);

        $this->makeLiveAuctionWithActiveLane();

        $this->artisan('countdown:start')->assertExitCode(0);
    }

    public function test_command_accepts_auction_id_argument(): void
    {
        $ctx = $this->makeLiveAuctionWithActiveLane();
        // 別のライブ auction を立てておく → 対象外
        Auction::factory()->live()->create();

        $this->artisan('countdown:start', ['auction_id' => $ctx['auction']->id])
            ->assertExitCode(0);

        Bus::assertDispatchedTimes(ProcessAuctionCountdownJob::class, 1);
    }

    public function test_command_warns_lane_without_live_item(): void
    {
        $auction = Auction::factory()->live()->create();
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        // status=registered（live ではない） → currentItem なしと同等の扱い
        $item = Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
            'status' => 'registered',
        ]);
        Lane::factory()->active()->create([
            'auction_id' => $auction->id,
            'lane_number' => 1,
            'current_item_id' => $item->id,
        ]);

        $this->artisan('countdown:start')
            ->expectsOutputToContain('has no live item')
            ->assertExitCode(0);
    }
}
