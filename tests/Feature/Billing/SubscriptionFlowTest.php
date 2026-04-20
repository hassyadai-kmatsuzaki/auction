<?php

namespace Tests\Feature\Billing;

use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SubscriptionFlowTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();

        // Square のテスト用設定
        config([
            'services.square.environment'   => 'sandbox',
            'services.square.access_token'  => 'test-token',
            'services.square.location_id'   => 'TESTLOC',
            'services.square.application_id'=> 'sandbox-app',
            'services.square.currency'      => 'JPY',
            'services.square.webhook_url'   => 'https://example.com/api/webhooks/square',
            'services.square.webhook_signature_key' => 'whsig',
        ]);
    }

    private function makePlan(array $override = []): Plan
    {
        return Plan::create(array_merge([
            'code'        => 'bid_only',
            'name'        => '落札専用',
            'amount'      => 5000,
            'allows_bid'  => true,
            'allows_sell' => false,
            'is_active'   => true,
            'sort_order'  => 1,
        ], $override));
    }

    public function test_user_can_subscribe_with_successful_square_flow(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/customers' => Http::response(['customer' => ['id' => 'CUST_1']], 200),
            '*connect.squareupsandbox.com/v2/cards'     => Http::response(['card' => [
                'id' => 'CARD_1',
                'card_brand' => 'VISA',
                'last_4' => '1111',
                'exp_month' => 12,
                'exp_year'  => 2030,
            ]], 200),
            '*connect.squareupsandbox.com/v2/payments'  => Http::response(['payment' => [
                'id' => 'PAY_1',
                'status' => 'COMPLETED',
                'order_id' => 'ORDER_1',
                'receipt_url' => 'https://sq.ex/r/abc',
            ]], 200),
        ]);

        $plan = $this->makePlan();
        $user = $this->createParticipant();

        $res = $this->actingAs($user, 'sanctum')->postJson('/api/me/subscription', [
            'plan_id'   => $plan->id,
            'source_id' => 'cnon:card-nonce-ok',
        ]);

        $res->assertStatus(201);
        $this->assertDatabaseHas('subscriptions', [
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status'  => 'active',
            'square_customer_id' => 'CUST_1',
            'square_card_id'     => 'CARD_1',
            'card_last4'         => '1111',
        ]);
        $this->assertDatabaseHas('payments', [
            'user_id' => $user->id,
            'amount'  => 5000,
            'status'  => 'completed',
            'square_payment_id' => 'PAY_1',
        ]);
    }

    public function test_user_subscribe_fails_when_square_payment_fails(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/customers' => Http::response(['customer' => ['id' => 'CUST_2']], 200),
            '*connect.squareupsandbox.com/v2/cards'     => Http::response(['card' => ['id' => 'CARD_2', 'card_brand' => 'VISA', 'last_4' => '0002']], 200),
            '*connect.squareupsandbox.com/v2/payments'  => Http::response([
                'errors' => [['code' => 'CARD_DECLINED', 'detail' => 'card declined']],
            ], 402),
            '*connect.squareupsandbox.com/v2/cards/CARD_2/disable' => Http::response([], 200),
        ]);

        $plan = $this->makePlan();
        $user = $this->createParticipant();

        $res = $this->actingAs($user, 'sanctum')->postJson('/api/me/subscription', [
            'plan_id'   => $plan->id,
            'source_id' => 'cnon:declined',
        ]);

        $res->assertStatus(402);
        $this->assertDatabaseMissing('subscriptions', ['user_id' => $user->id]);
    }

    public function test_check_subscription_middleware_blocks_without_active_sub(): void
    {
        $user = $this->createParticipant();

        // 入札系エンドポイント（toggle）は allows_bid が必要
        $this->actingAs($user, 'sanctum')
            ->postJson('/api/participant/bids', ['item_id' => 1])
            ->assertStatus(402);
    }

    public function test_check_subscription_middleware_blocks_when_plan_lacks_capability(): void
    {
        $plan = $this->makePlan(['allows_bid' => false, 'allows_sell' => true, 'code' => 'sell_only']);
        $user = $this->createParticipant();
        Subscription::create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status'  => Subscription::STATUS_ACTIVE,
            'current_period_start' => now(),
            'current_period_end'   => now()->addYear(),
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/participant/bids', ['item_id' => 1])
            ->assertStatus(403)
            ->assertJsonPath('code', 'PLAN_CAPABILITY_MISSING');
    }

    public function test_admin_bypasses_subscription_check(): void
    {
        // admin が participant ロールを兼任している場合でも blocked されない
        $admin = $this->createAdmin();
        $admin->roles()->attach(\App\Models\Role::where('name', 'participant')->first()->id);

        // admin にはサブスクなし、でも許可される
        $res = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/participant/bids', ['item_id' => 1]);

        // bid endpoint 側のバリデーションで落ちることは許容、middleware で 402/403 にはならない
        $this->assertNotContains($res->status(), [402]);
    }
}
