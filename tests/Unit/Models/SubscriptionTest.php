<?php

namespace Tests\Unit\Models;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class SubscriptionTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->user = User::factory()->create();
    }

    private function makeSub(array $overrides = [], ?Plan $plan = null): Subscription
    {
        return Subscription::factory()->create(array_merge([
            'user_id' => $this->user->id,
            'plan_id' => ($plan ?? Plan::factory()->create())->id,
        ], $overrides));
    }

    public function test_user_リレーション(): void
    {
        $sub = $this->makeSub();

        $this->assertInstanceOf(User::class, $sub->user);
        $this->assertSame($this->user->id, $sub->user->id);
    }

    public function test_plan_リレーション(): void
    {
        $plan = Plan::factory()->create(['name' => 'プレミアム']);
        $sub = $this->makeSub([], $plan);

        $this->assertInstanceOf(Plan::class, $sub->plan);
        $this->assertSame($plan->id, $sub->plan->id);
    }

    public function test_isActive_期限内active_でtrue(): void
    {
        $sub = $this->makeSub([
            'status' => Subscription::STATUS_ACTIVE,
            'current_period_end' => now()->addMonth(),
        ]);

        $this->assertTrue($sub->isActive());
    }

    public function test_isActive_期限切れactive_でfalse(): void
    {
        $sub = $this->makeSub([
            'status' => Subscription::STATUS_ACTIVE,
            'current_period_end' => now()->subDay(),
        ]);

        $this->assertFalse($sub->isActive());
    }

    public function test_isActive_canceled_でfalse(): void
    {
        $sub = $this->makeSub([
            'status' => Subscription::STATUS_CANCELED,
            'current_period_end' => now()->addMonth(),
        ]);

        $this->assertFalse($sub->isActive());
    }

    public function test_isSuspended_はsuspendedとpastDueでtrue(): void
    {
        $suspended = $this->makeSub(['status' => Subscription::STATUS_SUSPENDED]);
        $this->assertTrue($suspended->isSuspended());

        $pastDue = Subscription::factory()->create([
            'user_id' => User::factory()->create()->id,
            'plan_id' => Plan::factory()->create()->id,
            'status' => Subscription::STATUS_PAST_DUE,
        ]);
        $this->assertTrue($pastDue->isSuspended());
    }

    public function test_isSuspended_はactiveでfalse(): void
    {
        $sub = $this->makeSub(['status' => Subscription::STATUS_ACTIVE]);

        $this->assertFalse($sub->isSuspended());
    }

    public function test_scopeActive_はactiveのみ抽出する(): void
    {
        $this->makeSub(['status' => Subscription::STATUS_ACTIVE]);
        Subscription::factory()->create([
            'user_id' => User::factory()->create()->id,
            'plan_id' => Plan::factory()->create()->id,
            'status' => Subscription::STATUS_CANCELED,
        ]);

        $this->assertSame(1, Subscription::active()->count());
    }

    public function test_scopeDueForRenewal_は期限切れactiveを抽出する(): void
    {
        $this->makeSub([
            'status' => Subscription::STATUS_ACTIVE,
            'current_period_end' => now()->subDay(),
        ]);
        // 未来の期限のものは抽出されない
        Subscription::factory()->create([
            'user_id' => User::factory()->create()->id,
            'plan_id' => Plan::factory()->create()->id,
            'status' => Subscription::STATUS_ACTIVE,
            'current_period_end' => now()->addMonth(),
        ]);

        $this->assertSame(1, Subscription::dueForRenewal()->count());
    }

    public function test_期限と取消日時はCarbonへキャスト(): void
    {
        $sub = $this->makeSub([
            'current_period_end' => '2026-12-01 00:00:00',
            'canceled_at' => '2026-04-01 12:34:56',
        ]);

        $this->assertInstanceOf(Carbon::class, $sub->current_period_end);
        $this->assertInstanceOf(Carbon::class, $sub->canceled_at);
    }

    public function test_プラン能力フラグはuser経由で判定できる_canBid(): void
    {
        $plan = Plan::factory()->create(['allows_bid' => true, 'allows_sell' => false]);
        $this->makeSub([
            'status' => Subscription::STATUS_ACTIVE,
            'current_period_end' => now()->addMonth(),
        ], $plan);

        $this->assertTrue($this->user->fresh()->canBid());
        $this->assertFalse($this->user->fresh()->canSell());
    }

    public function test_プラン能力フラグはuser経由で判定できる_canSell(): void
    {
        $plan = Plan::factory()->create(['allows_bid' => false, 'allows_sell' => true]);
        $this->makeSub([
            'status' => Subscription::STATUS_ACTIVE,
            'current_period_end' => now()->addMonth(),
        ], $plan);

        $this->assertTrue($this->user->fresh()->canSell());
        $this->assertFalse($this->user->fresh()->canBid());
    }
}
