<?php

namespace Tests\Feature\Billing;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Payment\SubscriptionService;
use Mockery;
use Tests\TestCase;

/**
 * F-086 会員自身による自動更新の停止（期間満了までは利用可）
 */
class AutoRenewStopTest extends TestCase
{
    private User $user;
    private Subscription $sub;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        config(['features.subscription_self_service' => true]);
        $this->user = $this->createParticipant();
        $plan = Plan::factory()->create(['code' => 'bid_only', 'amount' => 5500, 'duration_days' => null]);
        $this->sub = Subscription::factory()->create([
            'user_id' => $this->user->id,
            'plan_id' => $plan->id,
            'status' => Subscription::STATUS_ACTIVE,
            'current_period_start' => now()->subMonths(6),
            'current_period_end' => now()->addMonths(6),
            'canceled_at' => null,
            'suspended_reason' => null,
        ]);
    }

    private function setAutoRenew(bool $enabled)
    {
        return $this->actingAs($this->user, 'sanctum')->putJson('/api/me/subscription/auto-renew', ['enabled' => $enabled]);
    }

    public function test_stop_keeps_subscription_usable_until_period_end(): void
    {
        $this->setAutoRenew(false)->assertOk()->assertJsonPath('data.auto_renew_stopped', true);

        $sub = $this->sub->fresh();
        $this->assertSame(Subscription::STATUS_ACTIVE, $sub->status);
        $this->assertTrue($sub->isActive());
        $this->assertTrue($sub->isAutoRenewStopped());

        $this->actingAs($this->user, 'sanctum')->getJson('/api/me/subscription')
            ->assertOk()
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.auto_renew_stopped', true);
    }

    public function test_resume_clears_the_stop(): void
    {
        $this->setAutoRenew(false)->assertOk();
        $this->setAutoRenew(true)->assertOk()->assertJsonPath('data.auto_renew_stopped', false);

        $sub = $this->sub->fresh();
        $this->assertNull($sub->canceled_at);
        $this->assertNull($sub->suspended_reason);
    }

    public function test_renew_command_does_not_charge_stopped_and_cancels_at_period_end(): void
    {
        app(SubscriptionService::class)->stopAutoRenew($this->sub);
        $this->sub->update(['current_period_end' => now()->subMinute()]);

        // Square は呼ばれても何もしないモックにする。再課金されていないことは payments が増えないことで確かめる
        $square = Mockery::mock(\App\Services\Payment\SquareClient::class)->shouldIgnoreMissing();
        $this->app->instance(\App\Services\Payment\SquareClient::class, $square);

        $this->artisan('subscriptions:renew')->assertExitCode(0);

        $this->assertSame(0, \App\Models\Payment::count());
        $sub = $this->sub->fresh();
        $this->assertSame(Subscription::STATUS_CANCELED, $sub->status);
        $this->assertSame(Subscription::REASON_AUTO_RENEW_STOPPED, $sub->suspended_reason);
    }

    public function test_due_for_renewal_still_includes_normal_and_legacy_rows(): void
    {
        // 旧データ（理由が別・canceled_at だけ入っている等）は従来どおり更新対象のまま
        $this->sub->update(['current_period_end' => now()->subMinute(), 'canceled_at' => now()->subYear(), 'suspended_reason' => null]);

        $this->assertTrue(Subscription::dueForRenewal()->whereKey($this->sub->id)->exists());
        $this->assertFalse($this->sub->fresh()->isAutoRenewStopped());
    }

    public function test_one_shot_plan_cannot_be_stopped_and_feature_off_is_404(): void
    {
        $this->sub->plan->update(['duration_days' => 14]);
        $this->setAutoRenew(false)->assertStatus(422);

        config(['features.subscription_self_service' => false]);
        $this->setAutoRenew(false)->assertStatus(404);
    }
}
