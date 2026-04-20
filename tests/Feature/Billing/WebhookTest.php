<?php

namespace Tests\Feature\Billing;

use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use Tests\TestCase;

class WebhookTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        config([
            'services.square.webhook_signature_key' => 'whsig-key',
            'services.square.webhook_url' => 'https://example.com/api/webhooks/square',
        ]);
    }

    private function sign(string $body): string
    {
        return base64_encode(hash_hmac(
            'sha256',
            config('services.square.webhook_url') . $body,
            config('services.square.webhook_signature_key'),
            true
        ));
    }

    public function test_webhook_rejects_invalid_signature(): void
    {
        $body = json_encode(['event_id' => 'evt-1', 'type' => 'payment.updated']);
        $res = $this->call('POST', '/api/webhooks/square', [], [], [], [
            'HTTP_X-Square-Hmacsha256-Signature' => 'wrong',
            'CONTENT_TYPE' => 'application/json',
        ], $body);

        $res->assertStatus(401);
    }

    public function test_webhook_marks_subscription_suspended_on_failed_payment(): void
    {
        // 準備: active サブスク + completed payment
        $user = $this->createParticipant();
        $plan = Plan::create([
            'code' => 'bid_only', 'name' => 'bid only', 'amount' => 1000,
            'allows_bid' => true, 'allows_sell' => false, 'is_active' => true,
        ]);
        $sub = Subscription::create([
            'user_id' => $user->id, 'plan_id' => $plan->id,
            'status' => 'active',
            'current_period_start' => now(),
            'current_period_end' => now()->addYear(),
        ]);
        $payment = Payment::create([
            'subscription_id' => $sub->id,
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'square_payment_id' => 'PAY_FAIL',
            'idempotency_key' => 'iko-1',
            'amount' => 1000,
            'currency' => 'JPY',
            'status' => 'completed',
            'paid_at' => now(),
        ]);

        $body = json_encode([
            'event_id' => 'evt-fail-1',
            'type'     => 'payment.updated',
            'data'     => ['object' => ['payment' => ['id' => 'PAY_FAIL', 'status' => 'FAILED']]],
        ]);

        $res = $this->call('POST', '/api/webhooks/square', [], [], [], [
            'HTTP_X-Square-Hmacsha256-Signature' => $this->sign($body),
            'CONTENT_TYPE' => 'application/json',
        ], $body);

        $res->assertStatus(200);
        $this->assertDatabaseHas('payments', ['square_payment_id' => 'PAY_FAIL', 'status' => 'failed']);
        $this->assertDatabaseHas('subscriptions', ['id' => $sub->id, 'status' => 'suspended']);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'is_active' => false]);
    }

    public function test_webhook_is_idempotent(): void
    {
        $body = json_encode([
            'event_id' => 'evt-dup-1',
            'type'     => 'payment.updated',
            'data'     => ['object' => ['payment' => ['id' => 'PAY_UNKNOWN', 'status' => 'COMPLETED']]],
        ]);
        $sig = $this->sign($body);

        $headers = ['HTTP_X-Square-Hmacsha256-Signature' => $sig, 'CONTENT_TYPE' => 'application/json'];
        $this->call('POST', '/api/webhooks/square', [], [], [], $headers, $body)->assertStatus(200);
        $this->call('POST', '/api/webhooks/square', [], [], [], $headers, $body)->assertStatus(200);

        $this->assertEquals(1, \Illuminate\Support\Facades\DB::table('square_webhook_events')->where('event_id', 'evt-dup-1')->count());
    }
}
