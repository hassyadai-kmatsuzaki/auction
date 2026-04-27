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

    public function test_renew_treats_non_completed_status_as_failure(): void
    {
        // Square から errors なしだが status=PENDING のような中途半端な応答
        Http::fake([
            '*connect.squareupsandbox.com/v2/payments' => Http::response([
                'payment' => ['id' => 'PAY_PEND', 'status' => 'PENDING'],
            ], 200),
        ]);

        $sub = $this->makeSub();
        $payment = app(SubscriptionService::class)->renew($sub->fresh('plan'));

        $this->assertEquals(Payment::STATUS_FAILED, $payment->status);
        $sub->refresh();
        $this->assertEquals(Subscription::STATUS_SUSPENDED, $sub->status);
    }

    public function test_retryCharge_extends_period_and_clears_suspension(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/payments' => Http::response([
                'payment' => ['id' => 'PAY_RETRY', 'status' => 'COMPLETED'],
            ], 200),
        ]);

        $sub = $this->makeSub();
        $sub->update([
            'status' => Subscription::STATUS_SUSPENDED,
            'suspended_at' => now()->subHour(),
            'suspended_reason' => 'card declined',
        ]);

        $payment = app(SubscriptionService::class)->retryCharge($sub->fresh('plan'));

        $this->assertEquals(Payment::STATUS_COMPLETED, $payment->status);
        $sub->refresh();
        $this->assertEquals(Subscription::STATUS_ACTIVE, $sub->status);
        $this->assertNull($sub->suspended_at);
        $this->assertNull($sub->suspended_reason);
    }

    public function test_replaceCard_swaps_card_and_disables_old(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/cards' => Http::response([
                'card' => [
                    'id' => 'CARD_NEW',
                    'card_brand' => 'JCB',
                    'last_4' => '9999',
                    'exp_month' => 5,
                    'exp_year' => 2031,
                ],
            ], 200),
            '*connect.squareupsandbox.com/v2/cards/CARD_OLD/disable' => Http::response([], 200),
        ]);

        $sub = $this->makeSub(['square_card_id' => 'CARD_OLD']);

        $updated = app(SubscriptionService::class)->replaceCard($sub->user, 'cnon:new');

        $this->assertSame('CARD_NEW', $updated->square_card_id);
        $this->assertSame('JCB', $updated->card_brand);
        $this->assertSame('9999', $updated->card_last4);
        $this->assertSame('05', $updated->card_exp_month);
        $this->assertSame('2031', $updated->card_exp_year);
        Http::assertSent(fn ($req) => str_contains($req->url(), '/cards/CARD_OLD/disable'));
    }

    public function test_replaceCard_auto_retries_when_suspended(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/cards' => Http::response([
                'card' => ['id' => 'CARD_NEW2', 'card_brand' => 'VISA', 'last_4' => '1212'],
            ], 200),
            '*connect.squareupsandbox.com/v2/cards/*/disable' => Http::response([], 200),
            '*connect.squareupsandbox.com/v2/payments' => Http::response([
                'payment' => ['id' => 'PAY_RETRY_OK', 'status' => 'COMPLETED'],
            ], 200),
        ]);

        $sub = $this->makeSub(['square_card_id' => 'CARD_OLD2']);
        $sub->user->update(['is_active' => false, 'status' => 'suspended']);
        $sub->update(['status' => Subscription::STATUS_SUSPENDED, 'suspended_at' => now()]);

        app(SubscriptionService::class)->replaceCard($sub->user->fresh(), 'cnon:new');

        $sub->refresh();
        $this->assertSame(Subscription::STATUS_ACTIVE, $sub->status);
        $this->assertTrue((bool) $sub->user->fresh()->is_active);
    }

    public function test_cancel_disables_card_and_marks_canceled(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/cards/CARD_C/disable' => Http::response([], 200),
        ]);

        $sub = $this->makeSub(['square_card_id' => 'CARD_C']);
        app(SubscriptionService::class)->cancel($sub, 'ユーザー解約');

        $sub->refresh();
        $this->assertSame(Subscription::STATUS_CANCELED, $sub->status);
        $this->assertNotNull($sub->canceled_at);
        $this->assertSame('ユーザー解約', $sub->suspended_reason);
        Http::assertSent(fn ($req) => str_contains($req->url(), '/cards/CARD_C/disable'));
    }

    public function test_markSuspended_truncates_long_reason_and_suspends_user(): void
    {
        $sub = $this->makeSub();
        $longReason = str_repeat('あ', 400); // 255文字超

        app(SubscriptionService::class)->markSuspended($sub, $longReason);

        $sub->refresh();
        $this->assertSame(Subscription::STATUS_SUSPENDED, $sub->status);
        $this->assertNotNull($sub->suspended_at);
        $this->assertLessThanOrEqual(255, mb_strlen($sub->suspended_reason));

        $sub->user->refresh();
        $this->assertFalse((bool) $sub->user->is_active);
        $this->assertSame('suspended', $sub->user->status);
    }

    public function test_reactivateUser_flips_user_back_to_approved(): void
    {
        $sub = $this->makeSub();
        $sub->user->update(['is_active' => false, 'status' => 'suspended']);

        app(SubscriptionService::class)->reactivateUser($sub->fresh());

        $sub->user->refresh();
        $this->assertTrue((bool) $sub->user->is_active);
        $this->assertSame('approved', $sub->user->status);
    }

    public function test_retryCharge_throws_when_square_info_missing(): void
    {
        $sub = $this->makeSub(['square_customer_id' => null, 'square_card_id' => null]);
        $this->expectException(\RuntimeException::class);
        app(SubscriptionService::class)->retryCharge($sub->fresh('plan'));
    }

    /**
     * テスト用ヘルパ: 標準的な active サブスクリプションを作る
     */
    private function makeSub(array $override = []): Subscription
    {
        $user = $this->createParticipant();
        $plan = Plan::create(array_merge([
            'code' => 'bid_only_' . uniqid(), 'name' => 'x', 'amount' => 3000,
            'allows_bid' => true, 'allows_sell' => false, 'is_active' => true,
        ]));
        return Subscription::create(array_merge([
            'user_id' => $user->id, 'plan_id' => $plan->id,
            'square_customer_id' => 'C', 'square_card_id' => 'CA',
            'status' => 'active',
            'current_period_start' => now()->subYear(),
            'current_period_end'   => now()->subDay(),
        ], $override));
    }
}
