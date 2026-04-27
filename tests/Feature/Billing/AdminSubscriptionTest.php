<?php

namespace Tests\Feature\Billing;

use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * 管理者用サブスクリプション運用画面のテスト。
 *
 * /admin/subscriptions index/show/cancel/retry を網羅する。
 */
class AdminSubscriptionTest extends TestCase
{
    private User $admin;
    private Plan $plan;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        config([
            'services.square.environment'  => 'sandbox',
            'services.square.access_token' => 'tok',
            'services.square.location_id'  => 'LOC',
            'services.square.currency'     => 'JPY',
        ]);
        $this->plan = Plan::factory()->create(['code' => 'admin_test_plan']);
    }

    private function makeActiveSubscription(?User $user = null): Subscription
    {
        $user ??= $this->createParticipant();
        return Subscription::create([
            'user_id' => $user->id,
            'plan_id' => $this->plan->id,
            'square_customer_id' => 'CUST_X',
            'square_card_id' => 'CARD_X',
            'status' => Subscription::STATUS_ACTIVE,
            'current_period_start' => now()->subMonth(),
            'current_period_end' => now()->addMonth(),
        ]);
    }

    public function test_admin_can_list_subscriptions_with_pagination(): void
    {
        $sub1 = $this->makeActiveSubscription();
        $sub2 = $this->makeActiveSubscription();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/subscriptions');

        $response->assertOk()
            ->assertJsonStructure([
                'success',
                'data' => [
                    'subscriptions',
                    'pagination' => ['total', 'per_page', 'current_page', 'last_page'],
                ],
            ]);
        $this->assertGreaterThanOrEqual(2, $response->json('data.pagination.total'));
    }

    public function test_admin_can_filter_subscriptions_by_status(): void
    {
        $active = $this->makeActiveSubscription();
        $suspended = $this->makeActiveSubscription();
        $suspended->update(['status' => Subscription::STATUS_SUSPENDED]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/subscriptions?status=suspended');

        $response->assertOk();
        $items = collect($response->json('data.subscriptions'));
        $this->assertTrue($items->every(fn ($s) => $s['status'] === 'suspended'));
    }

    public function test_admin_can_filter_subscriptions_by_search_email(): void
    {
        $user = $this->createParticipant();
        $user->update(['email' => 'unique-search@example.com']);
        $sub = $this->makeActiveSubscription($user);
        $this->makeActiveSubscription(); // 別のユーザー（ヒットしない）

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/subscriptions?search=unique-search');

        $response->assertOk();
        $ids = collect($response->json('data.subscriptions'))->pluck('id')->all();
        $this->assertContains($sub->id, $ids);
    }

    public function test_admin_can_show_subscription_with_payments(): void
    {
        $sub = $this->makeActiveSubscription();
        Payment::create([
            'subscription_id' => $sub->id,
            'user_id' => $sub->user_id,
            'plan_id' => $sub->plan_id,
            'amount' => 12000,
            'currency' => 'JPY',
            'status' => Payment::STATUS_COMPLETED,
            'paid_at' => now(),
            'idempotency_key' => 'test-key-' . uniqid(),
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/subscriptions/{$sub->id}");

        $response->assertOk()
            ->assertJsonPath('data.subscription.id', $sub->id);
        $this->assertNotEmpty($response->json('data.subscription.payments'));
    }

    public function test_admin_can_force_cancel_subscription(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/cards/*/disable' => Http::response([], 200),
        ]);

        $sub = $this->makeActiveSubscription();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/subscriptions/{$sub->id}/cancel", [
                'reason' => '管理者判断による強制解約',
            ]);

        $response->assertOk()
            ->assertJson(['success' => true]);

        $sub->refresh();
        $this->assertSame(Subscription::STATUS_CANCELED, $sub->status);
        $this->assertNotNull($sub->canceled_at);
        $this->assertSame('管理者判断による強制解約', $sub->suspended_reason);
    }

    public function test_admin_retry_succeeds_and_reactivates_user(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/payments' => Http::response([
                'payment' => ['id' => 'PAY_RETRY_OK', 'status' => 'COMPLETED'],
            ], 200),
        ]);

        $user = $this->createParticipant();
        $user->update(['is_active' => false, 'status' => 'suspended']);
        $sub = $this->makeActiveSubscription($user);
        $sub->update([
            'status' => Subscription::STATUS_SUSPENDED,
            'suspended_at' => now()->subDay(),
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/subscriptions/{$sub->id}/retry");

        $response->assertOk()
            ->assertJson(['success' => true]);

        $sub->refresh();
        $this->assertSame(Subscription::STATUS_ACTIVE, $sub->status);
        $this->assertNull($sub->suspended_at);

        $user->refresh();
        $this->assertTrue((bool) $user->is_active);
        $this->assertSame('approved', $user->status);
    }

    public function test_admin_retry_fails_keeps_user_suspended(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/payments' => Http::response([
                'errors' => [['code' => 'CARD_DECLINED', 'detail' => 'card declined']],
            ], 402),
        ]);

        $user = $this->createParticipant();
        $sub = $this->makeActiveSubscription($user);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/subscriptions/{$sub->id}/retry");

        $response->assertStatus(402)
            ->assertJsonPath('success', false);

        $sub->refresh();
        $this->assertSame(Subscription::STATUS_SUSPENDED, $sub->status);
    }

    public function test_non_admin_cannot_access_admin_subscriptions(): void
    {
        $participant = $this->createParticipant();
        $sub = $this->makeActiveSubscription();

        $this->actingAs($participant, 'sanctum')
            ->getJson('/api/admin/subscriptions')
            ->assertStatus(403);
    }
}
