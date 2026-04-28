<?php

namespace Tests\Unit\Jobs;

use App\Jobs\ProcessCountdownJob;
use App\Services\CountdownService;
use Mockery;
use Tests\TestCase;

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

    public function test_handle_exits_when_state_missing(): void
    {
        $service = Mockery::mock(CountdownService::class);
        $service->shouldReceive('getCountdownState')->once()->with(7)->andReturn(null);
        $service->shouldNotReceive('tick');

        (new ProcessCountdownJob(7, 1))->handle($service);
        $this->assertTrue(true);
    }

    public function test_handle_exits_when_state_not_running(): void
    {
        $service = Mockery::mock(CountdownService::class);
        $service->shouldReceive('getCountdownState')->once()->with(8)->andReturn(['is_running' => false]);
        $service->shouldNotReceive('tick');

        (new ProcessCountdownJob(8, 1))->handle($service);
        $this->assertTrue(true);
    }

    public function test_handle_breaks_on_countdown_end_without_next_item(): void
    {
        $service = Mockery::mock(CountdownService::class);
        $service->shouldReceive('getCountdownState')
            ->once()->with(9)->andReturn(['is_running' => true]);
        $service->shouldReceive('tick')
            ->once()->with(9)
            ->andReturn(['action' => 'countdown_end', 'next_item' => null]);

        (new ProcessCountdownJob(9, 1))->handle($service);
        $this->assertTrue(true);
    }

    public function test_handle_breaks_when_tick_throws(): void
    {
        $service = Mockery::mock(CountdownService::class);
        $service->shouldReceive('getCountdownState')
            ->once()->with(10)->andReturn(['is_running' => true]);
        $service->shouldReceive('tick')
            ->once()->with(10)
            ->andThrow(new \RuntimeException('boom'));

        // 例外でも握り潰してジョブは正常終了する
        (new ProcessCountdownJob(10, 1))->handle($service);
        $this->assertTrue(true);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
