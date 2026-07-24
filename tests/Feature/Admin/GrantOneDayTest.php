<?php

namespace Tests\Feature\Admin;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Tests\TestCase;

/**
 * 管理画面「1Day枠を付与 / 解除」（users.intended_plan_code の手動操作）。
 *
 * 2026-07-24 以降、単発プラン（1Day）はマーカー保持者にしか加入モーダルに出ない。
 * マーカーは本人の決済で自動解除されるため、失効した1Day会員にリピート購入させる
 * 唯一の導線がこのエンドポイントになる。
 */
class GrantOneDayTest extends TestCase
{
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();

        // one_day 行は migration 投入済み。テスト用に確実に有効化しておく。
        Plan::updateOrCreate(['code' => 'one_day'], [
            'name'          => '1Day会員',
            'amount'        => 500,
            'duration_days' => 14,
            'allows_bid'    => true,
            'allows_sell'   => false,
            'is_active'     => true,
            'sort_order'    => 3,
        ]);
    }

    public function test_admin_can_grant_one_day_slot_to_participant(): void
    {
        $user = $this->createParticipant();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/users/{$user->id}/grant-one-day")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertSame('one_day', User::find($user->id)->intended_plan_code);
    }

    public function test_granted_user_is_offered_only_the_one_day_plan(): void
    {
        Plan::updateOrCreate(['code' => 'bid_only'], [
            'name'        => '落札者プラン',
            'amount'      => 5500,
            'allows_bid'  => true,
            'allows_sell' => false,
            'is_active'   => true,
            'sort_order'  => 1,
        ]);
        $user = $this->createParticipant();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/users/{$user->id}/grant-one-day")
            ->assertOk();

        $res = $this->actingAs($user->fresh(), 'sanctum')->getJson('/api/me/subscription');
        $codes = collect($res->json('data.plans'))->pluck('code')->all();
        $this->assertSame(['one_day'], $codes);
    }

    public function test_grant_clears_switched_by_admin_marker(): void
    {
        // 切替済みマーカーが残ったままだと show() が単発プランを弾き、
        // 1Day 1択のはずが0件になる。付与時にマーカーを外す。
        $user = $this->createParticipant();
        $plan = Plan::where('code', 'one_day')->firstOrFail();
        Subscription::create([
            'user_id'              => $user->id,
            'plan_id'              => $plan->id,
            'status'               => Subscription::STATUS_CANCELED,
            'suspended_reason'     => Subscription::REASON_SWITCHED_BY_ADMIN,
            'current_period_start' => now()->subDays(20),
            'current_period_end'   => now()->subDays(6),
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/users/{$user->id}/grant-one-day")
            ->assertOk();

        $this->assertFalse($user->fresh()->subscription->isSwitchedByAdmin());

        $res = $this->actingAs($user->fresh(), 'sanctum')->getJson('/api/me/subscription');
        $this->assertSame(['one_day'], collect($res->json('data.plans'))->pluck('code')->all());
    }

    public function test_cannot_grant_to_seller(): void
    {
        $seller = $this->createSeller();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/users/{$seller->id}/grant-one-day")
            ->assertStatus(422);

        $this->assertNull(User::find($seller->id)->intended_plan_code);
    }

    public function test_cannot_grant_to_user_with_active_subscription(): void
    {
        $user = $this->createParticipantWithSubscription();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/users/{$user->id}/grant-one-day")
            ->assertStatus(422);

        $this->assertNull(User::find($user->id)->intended_plan_code);
    }

    public function test_cannot_grant_when_one_day_plan_is_inactive(): void
    {
        Plan::where('code', 'one_day')->update(['is_active' => false]);
        $user = $this->createParticipant();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/users/{$user->id}/grant-one-day")
            ->assertStatus(422);

        $this->assertNull(User::find($user->id)->intended_plan_code);
    }

    public function test_admin_can_revoke_one_day_slot(): void
    {
        $user = $this->createParticipant();
        $user->update(['intended_plan_code' => 'one_day']);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/users/{$user->id}/grant-one-day")
            ->assertOk();

        $this->assertNull(User::find($user->id)->intended_plan_code);
    }

    public function test_revoke_does_not_clear_annual_switch_marker(): void
    {
        // 会員種別切替で立てた bid_only/both マーカーを誤って消さない
        $user = $this->createParticipant();
        $user->update(['intended_plan_code' => 'bid_only']);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/users/{$user->id}/grant-one-day")
            ->assertStatus(422);

        $this->assertSame('bid_only', User::find($user->id)->intended_plan_code);
    }

    public function test_non_admin_cannot_grant(): void
    {
        $user = $this->createParticipant();

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/admin/users/{$user->id}/grant-one-day")
            ->assertStatus(403);
    }
}
