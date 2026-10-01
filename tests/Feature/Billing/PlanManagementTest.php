<?php

namespace Tests\Feature\Billing;

use App\Models\Plan;
use App\Models\User;
use Tests\TestCase;

class PlanManagementTest extends TestCase
{
    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
    }

    public function test_admin_can_list_plans(): void
    {
        Plan::create([
            'code' => 'bid_only', 'name' => '落札専用', 'amount' => 5000,
            'allows_bid' => true, 'allows_sell' => false, 'is_active' => true, 'sort_order' => 1,
        ]);

        $res = $this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/plans');

        // migration で one_day / onsite_free も投入済みのため、件数は DB 全件と一致すること
        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonCount(Plan::count(), 'data.plans');
        $this->assertContains('bid_only', array_column($res->json('data.plans'), 'code'));
    }

    public function test_admin_can_create_plan(): void
    {
        $res = $this->actingAs($this->admin, 'sanctum')->postJson('/api/admin/plans', [
            'code'        => 'both',
            'name'        => '落札・出品セット',
            'description' => '両方できるプラン',
            'amount'      => 12000,
            'allows_bid'  => true,
            'allows_sell' => true,
            'is_active'   => true,
            'sort_order'  => 3,
        ]);

        $res->assertStatus(201);
        $this->assertDatabaseHas('plans', ['code' => 'both', 'amount' => 12000]);
    }

    public function test_plan_requires_at_least_one_capability(): void
    {
        $res = $this->actingAs($this->admin, 'sanctum')->postJson('/api/admin/plans', [
            'code'        => 'invalid',
            'name'        => 'ダメプラン',
            'amount'      => 1000,
            'allows_bid'  => false,
            'allows_sell' => false,
        ]);

        $res->assertStatus(422);
    }

    public function test_non_admin_cannot_access(): void
    {
        $participant = $this->createParticipant();
        $this->actingAs($participant, 'sanctum')
            ->getJson('/api/admin/plans')
            ->assertStatus(403);
    }

    public function test_plan_cannot_be_deleted(): void
    {
        $plan = Plan::create([
            'code' => 'bid_only', 'name' => '落札専用', 'amount' => 5000,
            'allows_bid' => true, 'allows_sell' => false, 'is_active' => true,
        ]);

        $user = $this->createParticipant();
        \App\Models\Subscription::create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status'  => 'active',
            'current_period_start' => now(),
            'current_period_end'   => now()->addYear(),
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/plans/{$plan->id}")
            ->assertStatus(405); // 削除ルート自体が無い（履歴保護。受付停止は is_active で行う）

        $this->assertDatabaseHas('plans', ['id' => $plan->id]);
    }
}
