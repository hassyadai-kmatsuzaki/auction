<?php

namespace Tests\Unit\Jobs;

use App\Jobs\ProcessCountdownJob;
use App\Services\CountdownService;
use Mockery;
use Tests\TestCase;

/**
 * ProcessCountdownJob は ProcessAuctionCountdownJob に置き換わった非推奨ジョブ。
 * dispatch されても何もしない（警告ログのみ）ことを保証する。
 */
class ProcessCountdownJobTest extends TestCase
{
    public function test_default_properties_and_queue(): void
    {
        $job = new ProcessCountdownJob(42, 5);
        $this->assertSame(42, $job->laneId);
        $this->assertSame(5, $job->maxIterations);
        $this->assertSame(1, $job->tries);
        $this->assertSame(600, $job->timeout);
        $this->assertSame('countdown', $job->queue);
        $this->assertSame(500, ProcessCountdownJob::TICK_INTERVAL_MS);
    }

    public function test_handle_is_no_op_and_does_not_call_service(): void
    {
        $service = Mockery::mock(CountdownService::class);
        $service->shouldNotReceive('getCountdownState');
        $service->shouldNotReceive('tick');

        (new ProcessCountdownJob(7, 1))->handle($service);
        $this->assertTrue(true);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
