<?php

namespace Tests\Unit\Console;

use App\Jobs\ProcessAuctionCountdownJob;
use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Services\Monitoring\MetricRecorder;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * R3 (2026-09-14): auctions:monitor-jobs の追加分 — 開始直後の猶予、停止レーンの復旧、毎分のメトリクス。
 */
class MonitorAuctionJobsStallTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Bus::fake();
        Cache::flush();
    }

    private function liveAuctionStartedAgo(int $seconds): Auction
    {
        $auction = Auction::factory()->live()->create(['created_by' => $this->createAdmin()->id]);
        Auction::where('id', $auction->id)->update(['updated_at' => now()->subSeconds($seconds)]);
        return $auction->fresh();
    }

    public function test_開始直後は心拍が無くても再ディスパッチしない(): void
    {
        $auction = $this->liveAuctionStartedAgo(1);
        Lane::factory()->active()->create(['auction_id' => $auction->id, 'lane_number' => 1]);
        // 心拍なし（開始と同じ秒に走った状態。9/11 に発生）

        $this->artisan('auctions:monitor-jobs')->assertExitCode(0);

        Bus::assertNotDispatched(ProcessAuctionCountdownJob::class);
    }

    public function test_猶予を過ぎて心拍が無ければ再ディスパッチする(): void
    {
        $auction = $this->liveAuctionStartedAgo(120);
        Lane::factory()->active()->create(['auction_id' => $auction->id, 'lane_number' => 1]);

        $this->artisan('auctions:monitor-jobs')->assertExitCode(0);

        Bus::assertDispatched(ProcessAuctionCountdownJob::class);
    }

    public function test_確定済みの商品を指したまま止まったレーンを次の商品へ進める(): void
    {
        $auction = $this->liveAuctionStartedAgo(600);
        Cache::put("countdown_job_heartbeat:auction:{$auction->id}", now()->timestamp, 600); // ジョブは生きている

        $profile = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
        $lane = Lane::factory()->active()->create(['auction_id' => $auction->id, 'lane_number' => 1]);
        $sold = Item::factory()->sold()->create(['auction_id' => $auction->id, 'seller_profile_id' => $profile->id, 'item_number' => 1]);
        $next = Item::factory()->registered()->create(['auction_id' => $auction->id, 'seller_profile_id' => $profile->id, 'item_number' => 2, 'start_price' => 1000, 'current_price' => 1000]);
        $lane->items()->attach($sold->id, ['sequence_order' => 1]);
        $lane->items()->attach($next->id, ['sequence_order' => 2]);
        $lane->update(['current_item_id' => $sold->id]);
        Lane::where('id', $lane->id)->update(['updated_at' => now()->subSeconds(60)]); // 切替中ではなく、止まって 60 秒

        $this->mock(MetricRecorder::class, function ($m) use ($lane) {
            $m->shouldReceive('laneStalled')->once()->with($lane->id, \Mockery::any(), true, \Mockery::any());
            $m->shouldReceive('monitorRun')->once()->with(1, 1);
            $m->shouldIgnoreMissing();
        });

        $this->artisan('auctions:monitor-jobs')
            ->expectsOutputToContain("Lane {$lane->id}")
            ->assertExitCode(0);

        $this->assertSame($next->id, $lane->fresh()->current_item_id);
        $this->assertSame('live', $next->fresh()->status);
        Bus::assertNotDispatched(ProcessAuctionCountdownJob::class);
    }

    public function test_切替中の一瞬は停止とみなさない(): void
    {
        $auction = $this->liveAuctionStartedAgo(600);
        Cache::put("countdown_job_heartbeat:auction:{$auction->id}", now()->timestamp, 600);

        $profile = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
        $lane = Lane::factory()->active()->create(['auction_id' => $auction->id, 'lane_number' => 1]);
        $sold = Item::factory()->sold()->create(['auction_id' => $auction->id, 'seller_profile_id' => $profile->id, 'item_number' => 1]);
        $next = Item::factory()->registered()->create(['auction_id' => $auction->id, 'seller_profile_id' => $profile->id, 'item_number' => 2]);
        $lane->items()->attach($sold->id, ['sequence_order' => 1]);
        $lane->items()->attach($next->id, ['sequence_order' => 2]);
        $lane->update(['current_item_id' => $sold->id]); // updated_at = 今

        $this->mock(MetricRecorder::class, function ($m) {
            $m->shouldReceive('monitorRun')->once()->with(1, 0);
            $m->shouldNotReceive('laneStalled');
            $m->shouldIgnoreMissing();
        });

        $this->artisan('auctions:monitor-jobs')->assertExitCode(0);

        $this->assertSame($sold->id, $lane->fresh()->current_item_id);
        $this->assertSame('registered', $next->fresh()->status);
    }

    public function test_ライブが無くても毎分の心拍メトリクスを出す(): void
    {
        $this->mock(MetricRecorder::class, function ($m) {
            $m->shouldReceive('monitorRun')->once()->with(0, 0);
        });

        $this->artisan('auctions:monitor-jobs')->assertExitCode(0);
    }
}
