<?php

namespace Tests\Unit\Console;

use App\Jobs\ProcessAuctionCountdownJob;
use App\Models\Auction;
use App\Models\Lane;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class MonitorAuctionJobsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Bus::fake();
        Cache::flush();
    }

    public function test_command_exits_zero_with_no_live_auctions(): void
    {
        $this->artisan('auctions:monitor-jobs')->assertExitCode(0);

        Bus::assertNothingDispatched();
    }

    public function test_command_redispatches_when_heartbeat_is_stale(): void
    {
        $auction = Auction::factory()->live()->create();
        Lane::factory()->active()->create([
            'auction_id' => $auction->id,
            'lane_number' => 1,
        ]);

        // 60 秒前のハートビート → stale
        Cache::put("countdown_job_heartbeat:auction:{$auction->id}", now()->timestamp - 60, 600);

        $this->artisan('auctions:monitor-jobs')
            ->expectsOutputToContain("Auction {$auction->id}")
            ->assertExitCode(0);

        Bus::assertDispatched(ProcessAuctionCountdownJob::class, function ($job) use ($auction) {
            return $job->auctionId === $auction->id;
        });
    }

    public function test_command_skips_when_heartbeat_is_fresh(): void
    {
        $auction = Auction::factory()->live()->create();
        Lane::factory()->active()->create([
            'auction_id' => $auction->id,
            'lane_number' => 1,
        ]);

        // 直近のハートビート → 生きている
        Cache::put("countdown_job_heartbeat:auction:{$auction->id}", now()->timestamp - 5, 600);

        $this->artisan('auctions:monitor-jobs')->assertExitCode(0);

        Bus::assertNotDispatched(ProcessAuctionCountdownJob::class);
    }

    public function test_command_skips_when_finished_marker_is_set(): void
    {
        $auction = Auction::factory()->live()->create();
        Lane::factory()->active()->create([
            'auction_id' => $auction->id,
            'lane_number' => 1,
        ]);

        // 正常終了マーカーがあれば redispatch しない
        Cache::put("countdown_job_finished:auction:{$auction->id}", true, 600);

        $this->artisan('auctions:monitor-jobs')->assertExitCode(0);

        Bus::assertNotDispatched(ProcessAuctionCountdownJob::class);
    }

    public function test_command_skips_when_no_workable_lanes(): void
    {
        $auction = Auction::factory()->live()->create();
        // active/paused でないレーン
        Lane::factory()->finished()->create([
            'auction_id' => $auction->id,
            'lane_number' => 1,
        ]);

        // ハートビート無し → 通常なら再ディスパッチだが workable lane がないので何もしない
        $this->artisan('auctions:monitor-jobs')->assertExitCode(0);

        Bus::assertNotDispatched(ProcessAuctionCountdownJob::class);
    }
}
