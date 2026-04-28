<?php

namespace Tests\Unit\Jobs;

use App\Jobs\ProcessAuctionCountdownJob;
use App\Models\Auction;
use App\Services\CountdownService;
use Illuminate\Support\Facades\Cache;
use Mockery;
use Tests\TestCase;

class ProcessAuctionCountdownJobTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Cache::flush();
    }

    public function test_default_properties_and_queue(): void
    {
        $job = new ProcessAuctionCountdownJob(1, 10);
        $this->assertSame(1, $job->auctionId);
        $this->assertSame(10, $job->maxIterations);
        $this->assertSame(1, $job->tries);
        $this->assertSame(14400, $job->timeout);
        $this->assertSame('countdown', $job->queue);
    }

    public function test_generation_key_helper_returns_expected_format(): void
    {
        $this->assertSame(
            'countdown_job_generation:auction:7',
            ProcessAuctionCountdownJob::generationKey(7)
        );
    }

    public function test_handle_skips_when_generation_outdated(): void
    {
        $admin = $this->createAdmin();
        $auction = Auction::factory()->live()->create(['created_by' => $admin->id]);

        // ジョブ作成時の世代を 0 にしておき、その後 cache を 1 に進める
        $job = new ProcessAuctionCountdownJob($auction->id, 1);
        Cache::put(ProcessAuctionCountdownJob::generationKey($auction->id), 1);

        $service = Mockery::mock(CountdownService::class);
        $service->shouldNotReceive('tick');
        $service->shouldNotReceive('getCountdownState');

        $job->handle($service);

        // ロックも残らない
        $this->assertNull(Cache::get("countdown_job_lock:auction:{$auction->id}"));
    }

    public function test_handle_skips_when_lock_already_held(): void
    {
        $admin = $this->createAdmin();
        $auction = Auction::factory()->live()->create(['created_by' => $admin->id]);

        // 既に他ジョブがロック取得済み
        Cache::put("countdown_job_lock:auction:{$auction->id}", 99999, 60);

        $service = Mockery::mock(CountdownService::class);
        $service->shouldNotReceive('tick');

        (new ProcessAuctionCountdownJob($auction->id, 1))->handle($service);

        // 既存ロックの値が保持される
        $this->assertSame(99999, (int) Cache::get("countdown_job_lock:auction:{$auction->id}"));
    }

    public function test_handle_exits_when_auction_not_live(): void
    {
        $admin = $this->createAdmin();
        $auction = Auction::factory()->scheduled()->create(['created_by' => $admin->id]);

        $service = Mockery::mock(CountdownService::class);
        // active レーンが無いので tick 呼ばれず、status != live で即終了
        $service->shouldNotReceive('tick');

        (new ProcessAuctionCountdownJob($auction->id, 1))->handle($service);

        // 終了マーカーがセットされる
        $this->assertTrue((bool) Cache::get("countdown_job_finished:auction:{$auction->id}"));
        // ロックは解放
        $this->assertNull(Cache::get("countdown_job_lock:auction:{$auction->id}"));
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
