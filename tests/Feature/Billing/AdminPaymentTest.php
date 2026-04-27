<?php

namespace Tests\Feature\Billing;

use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * 管理者用決済管理 (Admin\PaymentController) のテスト。
 *
 * 一覧・詳細・返金フローと Square API 失敗時の挙動。
 */
class AdminPaymentTest extends TestCase
{
    private User $admin;
    private Plan $plan;
    private Subscription $subscription;

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
        $this->plan = Plan::factory()->create();
        $user = $this->createParticipant();
        $this->subscription = Subscription::create([
            'user_id' => $user->id,
            'plan_id' => $this->plan->id,
            'square_customer_id' => 'CUST',
            'square_card_id' => 'CARD',
            'status' => Subscription::STATUS_ACTIVE,
            'current_period_end' => now()->addYear(),
        ]);
    }

    private function makePayment(array $override = []): Payment
    {
        return Payment::create(array_merge([
            'subscription_id' => $this->subscription->id,
            'user_id' => $this->subscription->user_id,
            'plan_id' => $this->plan->id,
            'amount' => 12000,
            'currency' => 'JPY',
            'status' => Payment::STATUS_COMPLETED,
            'square_payment_id' => 'PAY_TEST_' . uniqid(),
            'paid_at' => now(),
            'idempotency_key' => 'k-' . uniqid(),
        ], $override));
    }

    public function test_admin_can_list_payments(): void
    {
        $this->makePayment();
        $this->makePayment();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/payments');

        $response->assertOk()
            ->assertJsonStructure(['data' => ['payments', 'pagination']]);
        $this->assertGreaterThanOrEqual(2, $response->json('data.pagination.total'));
    }

    public function test_admin_can_filter_payments_by_status(): void
    {
        $this->makePayment(['status' => Payment::STATUS_COMPLETED]);
        $this->makePayment(['status' => Payment::STATUS_FAILED, 'paid_at' => null]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/payments?status=failed');

        $response->assertOk();
        $items = $response->json('data.payments');
        $this->assertNotEmpty($items);
        foreach ($items as $p) {
            $this->assertSame('failed', $p['status']);
        }
    }

    public function test_admin_can_filter_payments_by_date_range(): void
    {
        $oldP = $this->makePayment(['paid_at' => now()->subYear()]);
        $newP = $this->makePayment(['paid_at' => now()->subDay()]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/payments?from=' . now()->subWeek()->toDateString());

        $ids = collect($response->json('data.payments'))->pluck('id')->all();
        $this->assertContains($newP->id, $ids);
        $this->assertNotContains($oldP->id, $ids);
    }

    public function test_admin_can_view_payment_detail(): void
    {
        $payment = $this->makePayment();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/payments/{$payment->id}");

        $response->assertOk()
            ->assertJsonPath('data.payment.id', $payment->id);
    }

    public function test_admin_can_refund_completed_payment_full_amount(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/refunds' => Http::response([
                'refund' => ['id' => 'REF_FULL', 'status' => 'COMPLETED', 'amount_money' => ['amount' => 12000]],
            ], 200),
        ]);
        $payment = $this->makePayment();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/payments/{$payment->id}/refund", [
                'reason' => 'カスタマー要望',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.payment.status', Payment::STATUS_REFUNDED)
            ->assertJsonPath('data.payment.refunded_amount', 12000);
        $this->assertDatabaseHas('payments', [
            'id' => $payment->id,
            'status' => Payment::STATUS_REFUNDED,
        ]);
    }

    public function test_admin_can_refund_partial_amount(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/refunds' => Http::response([
                'refund' => ['id' => 'REF_PART', 'status' => 'COMPLETED', 'amount_money' => ['amount' => 5000]],
            ], 200),
        ]);
        $payment = $this->makePayment(['amount' => 12000]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/payments/{$payment->id}/refund", [
                'amount' => 5000,
                'reason' => '一部返金',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.payment.refunded_amount', 5000);
    }

    public function test_admin_cannot_refund_more_than_payment_amount(): void
    {
        $payment = $this->makePayment(['amount' => 5000]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/payments/{$payment->id}/refund", [
                'amount' => 9999,
            ])
            ->assertStatus(422);
    }

    public function test_admin_cannot_refund_non_completed_payment(): void
    {
        $payment = $this->makePayment(['status' => Payment::STATUS_FAILED]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/payments/{$payment->id}/refund")
            ->assertStatus(409)
            ->assertJsonPath('success', false);
    }

    public function test_admin_cannot_refund_payment_without_square_payment_id(): void
    {
        $payment = $this->makePayment(['square_payment_id' => null]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/payments/{$payment->id}/refund")
            ->assertStatus(409);
    }

    public function test_refund_returns_502_when_square_fails(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/refunds' => Http::response([
                'errors' => [['code' => 'INVALID_REQUEST', 'detail' => 'oops']],
            ], 500),
        ]);
        $payment = $this->makePayment();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/payments/{$payment->id}/refund")
            ->assertStatus(502);

        // 失敗時は payment は完了のまま
        $payment->refresh();
        $this->assertSame(Payment::STATUS_COMPLETED, $payment->status);
    }

    public function test_non_admin_cannot_access_payment_admin(): void
    {
        $participant = $this->createParticipant();
        $this->actingAs($participant, 'sanctum')
            ->getJson('/api/admin/payments')
            ->assertStatus(403);
    }
}
