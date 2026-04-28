<?php

namespace Tests\Unit\Console;

use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Services\Payment\SubscriptionService;
use Mockery;
use Tests\TestCase;

class RenewSubscriptionsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function makeDueSubscription(): Subscription
    {
        $user = $this->createParticipant();
        $plan = Plan::factory()->create(['code' => 'bid_only', 'amount' => 3000]);

        return Subscription::factory()->create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => Subscription::STATUS_ACTIVE,
            'current_period_start' => now()->subYear(),
            'current_period_end' => now()->subDay(),
        ]);
    }

    private function bindRenewMock(string $status, ?string $reason = null, int $amount = 3000): void
    {
        $payment = new Payment([
            'amount' => $amount,
            'status' => $status,
            'failure_reason' => $reason,
        ]);

        $mock = Mockery::mock(SubscriptionService::class);
        $mock->shouldReceive('renew')->andReturn($payment);
        $this->app->instance(SubscriptionService::class, $mock);
    }

    public function test_command_reports_zero_when_nothing_due(): void
    {
        // 期限内の active のみ
        $user = $this->createParticipant();
        $plan = Plan::factory()->create();
        Subscription::factory()->create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => Subscription::STATUS_ACTIVE,
            'current_period_end' => now()->addMonth(),
        ]);

        $mock = Mockery::mock(SubscriptionService::class);
        $mock->shouldNotReceive('renew');
        $this->app->instance(SubscriptionService::class, $mock);

        $this->artisan('subscriptions:renew')
            ->expectsOutputToContain('更新対象: 0 件')
            ->expectsOutputToContain('完了: 成功 0 / 失敗 0')
            ->assertExitCode(0);
    }

    public function test_command_dry_run_lists_targets_without_charging(): void
    {
        $this->makeDueSubscription();

        $mock = Mockery::mock(SubscriptionService::class);
        $mock->shouldNotReceive('renew');
        $this->app->instance(SubscriptionService::class, $mock);

        $this->artisan('subscriptions:renew', ['--dry-run' => true])
            ->expectsOutputToContain('更新対象: 1 件')
            ->assertExitCode(0);
    }

    public function test_command_processes_due_subscriptions_successfully(): void
    {
        $sub = $this->makeDueSubscription();
        $this->bindRenewMock(Payment::STATUS_COMPLETED, null, 3000);

        $this->artisan('subscriptions:renew')
            ->expectsOutputToContain('更新対象: 1 件')
            ->expectsOutputToContain("OK  user={$sub->user_id}")
            ->expectsOutputToContain('完了: 成功 1 / 失敗 0')
            ->assertExitCode(0);
    }

    public function test_command_records_failure_when_payment_fails(): void
    {
        $this->makeDueSubscription();
        $this->bindRenewMock(Payment::STATUS_FAILED, 'card declined', 3000);

        $this->artisan('subscriptions:renew')
            ->expectsOutputToContain('NG')
            ->expectsOutputToContain('完了: 成功 0 / 失敗 1')
            ->assertExitCode(0);
    }

    public function test_command_handles_thrown_exception(): void
    {
        $this->makeDueSubscription();

        $mock = Mockery::mock(SubscriptionService::class);
        $mock->shouldReceive('renew')->andThrow(new \RuntimeException('square down'));
        $this->app->instance(SubscriptionService::class, $mock);

        $this->artisan('subscriptions:renew')
            ->expectsOutputToContain('ERR')
            ->expectsOutputToContain('完了: 成功 0 / 失敗 1')
            ->assertExitCode(0);
    }
}
