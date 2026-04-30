<?php

namespace Tests\Unit\Services\Payment;

use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Services\Payment\SquareApiException;
use App\Services\Payment\SubscriptionService;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

/**
 * SubscriptionService の Unit テスト (新規加入 / 補助メソッド)。
 *
 * renewal / replaceCard / cancel 系は SubscriptionRenewalTest 側でカバー済。
 * このファイルは subscribe() (新規加入フロー) と新規不能ケースに絞る。
 */
class SubscriptionServiceTest extends TestCase
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

    private function makePlan(array $override = []): Plan
    {
        return Plan::create(array_merge([
            'code' => 'bid_only_' . uniqid(),
            'name' => 'テストプラン',
            'amount' => 3000,
            'allows_bid' => true,
            'allows_sell' => false,
            'is_active' => true,
        ], $override));
    }

    public function test_subscribe_は_カスタマー作成からカード登録から決済までDBに記録する(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/customers' => Http::response([
                'customer' => ['id' => 'CUST_NEW'],
            ], 200),
            '*connect.squareupsandbox.com/v2/cards' => Http::response([
                'card' => [
                    'id' => 'CARD_NEW',
                    'card_brand' => 'VISA',
                    'last_4' => '1234',
                    'exp_month' => 4,
                    'exp_year' => 2030,
                ],
            ], 200),
            '*connect.squareupsandbox.com/v2/payments' => Http::response([
                'payment' => [
                    'id' => 'PAY_OK',
                    'status' => 'COMPLETED',
                    'order_id' => 'ORDER_OK',
                    'receipt_url' => 'https://example.com/r',
                ],
            ], 200),
        ]);

        $user = $this->createParticipant();
        $plan = $this->makePlan();

        $sub = app(SubscriptionService::class)->subscribe($user, $plan, 'cnon:source');

        $this->assertSame('CUST_NEW', $sub->square_customer_id);
        $this->assertSame('CARD_NEW', $sub->square_card_id);
        $this->assertSame('VISA', $sub->card_brand);
        $this->assertSame('1234', $sub->card_last4);
        $this->assertSame('04', $sub->card_exp_month);
        $this->assertSame(Subscription::STATUS_ACTIVE, $sub->status);
        $this->assertTrue($sub->current_period_end->isFuture());

        $this->assertDatabaseHas('payments', [
            'subscription_id' => $sub->id,
            'square_payment_id' => 'PAY_OK',
            'status' => Payment::STATUS_COMPLETED,
            'amount' => 3000,
        ]);
    }

    public function test_subscribe_は_過去の銀行振込フラグをリセットして加入後の振込モーダル誤表示を防ぐ(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/customers' => Http::response([
                'customer' => ['id' => 'CUST_RESET'],
            ], 200),
            '*connect.squareupsandbox.com/v2/cards' => Http::response([
                'card' => ['id' => 'CARD_RESET', 'card_brand' => 'VISA', 'last_4' => '4242'],
            ], 200),
            '*connect.squareupsandbox.com/v2/payments' => Http::response([
                'payment' => ['id' => 'PAY_RESET', 'status' => 'COMPLETED'],
            ], 200),
        ]);

        // 過去に銀行振込モードを試したまま canceled になっているユーザーを再現する。
        $user = $this->createParticipant();
        $user->forceFill([
            'payment_method_preference'  => 'bank_transfer',
            'bank_transfer_confirmed_at' => null,
        ])->save();
        $plan = $this->makePlan();
        Subscription::create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status'  => Subscription::STATUS_CANCELED,
            'canceled_at' => now()->subDay(),
        ]);

        app(SubscriptionService::class)->subscribe($user->fresh(), $plan, 'cnon:src');

        $fresh = $user->fresh();
        $this->assertSame('card', $fresh->payment_method_preference);
        $this->assertNull($fresh->bank_transfer_confirmed_at);
    }

    public function test_subscribe_は_未設定環境でRuntimeException(): void
    {
        config(['services.square.access_token' => '', 'services.square.location_id' => '']);

        $this->expectException(RuntimeException::class);
        app(SubscriptionService::class)->subscribe(
            $this->createParticipant(),
            $this->makePlan(),
            'cnon:x'
        );
    }

    public function test_subscribe_は_無効プランで例外(): void
    {
        $plan = $this->makePlan(['is_active' => false]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('加入');
        app(SubscriptionService::class)->subscribe(
            $this->createParticipant(),
            $plan,
            'cnon:x'
        );
    }

    public function test_subscribe_は_既に有効サブスクがある場合は例外(): void
    {
        $user = $this->createParticipant();
        $plan = $this->makePlan();
        Subscription::create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'square_customer_id' => 'C_EXIST',
            'square_card_id' => 'CA_EXIST',
            'status' => Subscription::STATUS_ACTIVE,
            'current_period_start' => now()->subMonth(),
            'current_period_end'   => now()->addMonths(11),
        ]);

        $this->expectException(RuntimeException::class);
        app(SubscriptionService::class)->subscribe($user->fresh(), $plan, 'cnon:x');
    }

    public function test_subscribe_は_canceledサブスクなら新規発行可能(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/customers' => Http::response([
                'customer' => ['id' => 'CUST2'],
            ], 200),
            '*connect.squareupsandbox.com/v2/cards' => Http::response([
                'card' => ['id' => 'CARD2', 'card_brand' => 'JCB', 'last_4' => '0001'],
            ], 200),
            '*connect.squareupsandbox.com/v2/payments' => Http::response([
                'payment' => ['id' => 'PAY2', 'status' => 'COMPLETED'],
            ], 200),
        ]);

        $user = $this->createParticipant();
        $plan = $this->makePlan();
        Subscription::create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'square_customer_id' => 'OLD',
            'square_card_id' => 'OLDCARD',
            'status' => Subscription::STATUS_CANCELED,
            'canceled_at' => now()->subDay(),
            'current_period_start' => now()->subYear(),
            'current_period_end' => now()->subDay(),
        ]);

        $sub = app(SubscriptionService::class)->subscribe($user->fresh(), $plan, 'cnon:src');

        $this->assertSame('CUST2', $sub->square_customer_id);
        $this->assertSame('CARD2', $sub->square_card_id);
        $this->assertSame(Subscription::STATUS_ACTIVE, $sub->status);
    }

    public function test_subscribe_は_決済失敗時にカード無効化して例外を上げる(): void
    {
        $disableCalled = false;

        Http::fake([
            '*connect.squareupsandbox.com/v2/customers' => Http::response([
                'customer' => ['id' => 'CUST_F'],
            ], 200),
            '*connect.squareupsandbox.com/v2/cards/CARD_F/disable' => function () use (&$disableCalled) {
                $disableCalled = true;
                return Http::response([], 200);
            },
            '*connect.squareupsandbox.com/v2/cards' => Http::response([
                'card' => ['id' => 'CARD_F', 'card_brand' => 'VISA', 'last_4' => '9999'],
            ], 200),
            '*connect.squareupsandbox.com/v2/payments' => Http::response([
                'errors' => [['code' => 'CARD_DECLINED', 'detail' => 'declined']],
            ], 402),
        ]);

        $this->expectException(SquareApiException::class);

        try {
            app(SubscriptionService::class)->subscribe(
                $this->createParticipant(),
                $this->makePlan(),
                'cnon:src'
            );
        } finally {
            $this->assertTrue($disableCalled, 'カード無効化が呼ばれているはず');
            $this->assertDatabaseMissing('subscriptions', ['square_customer_id' => 'CUST_F']);
        }
    }

    public function test_subscribe_は_決済PENDING応答でも失敗扱い(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/customers' => Http::response([
                'customer' => ['id' => 'CUST_P'],
            ], 200),
            '*connect.squareupsandbox.com/v2/cards/CARD_P/disable' => Http::response([], 200),
            '*connect.squareupsandbox.com/v2/cards' => Http::response([
                'card' => ['id' => 'CARD_P'],
            ], 200),
            '*connect.squareupsandbox.com/v2/payments' => Http::response([
                'payment' => ['id' => 'PAY_P', 'status' => 'PENDING'],
            ], 200),
        ]);

        $this->expectException(RuntimeException::class);
        app(SubscriptionService::class)->subscribe(
            $this->createParticipant(),
            $this->makePlan(),
            'cnon:src'
        );
    }

    public function test_subscribe_は_カスタマー作成失敗で例外(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/customers' => Http::response(['customer' => []], 200),
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('カスタマー');
        app(SubscriptionService::class)->subscribe(
            $this->createParticipant(),
            $this->makePlan(),
            'cnon:src'
        );
    }
}
