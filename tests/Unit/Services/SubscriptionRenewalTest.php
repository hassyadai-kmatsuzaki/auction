<?php

namespace Tests\Unit\Services;

use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Services\Payment\SubscriptionService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SubscriptionRenewalTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        config([
            'services.square.environment'  => 'sandbox',
            'services.square.access_token' => 'tok',
            'services.square.location_id'  => 'LOC',
            'services.square.currency'     => 'JPY',
        ]);
    }

    public function test_renew_extends_period_on_success(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/payments' => Http::response(['payment' => [
                'id' => 'PAY_R1',
                'status' => 'COMPLETED',
            ]], 200),
        ]);

        $user = $this->createParticipant();
        $plan = Plan::create([
            'code' => 'bid_only', 'name' => 'x', 'amount' => 3000,
            'allows_bid' => true, 'allows_sell' => false, 'is_active' => true,
        ]);
        $sub = Subscription::create([
            'user_id' => $user->id, 'plan_id' => $plan->id,
            'square_customer_id' => 'C', 'square_card_id' => 'CA',
            'status' => 'active',
            'current_period_start' => now()->subYear(),
            'current_period_end'   => now()->subDay(),
        ]);

        $service = app(SubscriptionService::class);
        $payment = $service->renew($sub->fresh('plan'));

        $this->assertEquals(Payment::STATUS_COMPLETED, $payment->status);
        $sub->refresh();
        $this->assertEquals('active', $sub->status);
        $this->assertTrue($sub->current_period_end->isFuture());
    }

    public function test_renew_suspends_on_failure(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/payments' => Http::response([
                'errors' => [['code' => 'CARD_DECLINED', 'detail' => 'declined']],
            ], 402),
        ]);

        $user = $this->createParticipant();
        $plan = Plan::create([
            'code' => 'bid_only', 'name' => 'x', 'amount' => 3000,
            'allows_bid' => true, 'allows_sell' => false, 'is_active' => true,
        ]);
        $sub = Subscription::create([
            'user_id' => $user->id, 'plan_id' => $plan->id,
            'square_customer_id' => 'C', 'square_card_id' => 'CA',
            'status' => 'active',
            'current_period_start' => now()->subYear(),
            'current_period_end'   => now()->subDay(),
        ]);

        $service = app(SubscriptionService::class);
        $payment = $service->renew($sub->fresh('plan'));

        $this->assertEquals(Payment::STATUS_FAILED, $payment->status);
        $sub->refresh();
        $this->assertEquals(Subscription::STATUS_SUSPENDED, $sub->status);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'is_active' => false]);
    }
}
