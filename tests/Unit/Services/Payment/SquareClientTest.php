<?php

namespace Tests\Unit\Services\Payment;

use App\Services\Payment\SquareApiException;
use App\Services\Payment\SquareClient;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * SquareClient の Unit テスト。Http::fake() で Square API を完全モック化する。
 *
 * REST API へのリクエスト形式 (URL, ヘッダ, body) と、
 * エラーレスポンスから SquareApiException が立ち上がることを確認する。
 */
class SquareClientTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.square.environment'  => 'sandbox',
            'services.square.access_token' => 'test_token',
            'services.square.api_version'  => '2024-10-17',
            'services.square.location_id'  => 'LOC_TEST',
            'services.square.currency'     => 'JPY',
            'services.square.webhook_signature_key' => 'whkey',
            'services.square.webhook_url'           => 'https://example.com/wh',
        ]);
    }

    public function test_isConfigured_は_必要設定が揃っていればtrue(): void
    {
        $client = new SquareClient();
        $this->assertTrue($client->isConfigured());
        $this->assertSame('JPY', $client->currency());
    }

    public function test_isConfigured_は_token不足でfalse(): void
    {
        config(['services.square.access_token' => '']);
        $this->assertFalse((new SquareClient())->isConfigured());
    }

    public function test_createCustomer_は_v2customers_に_適切なヘッダ付きでPOST(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/customers' => Http::response([
                'customer' => ['id' => 'CUST_X'],
            ], 200),
        ]);

        $result = (new SquareClient())->createCustomer([
            'idempotency_key' => 'k1',
            'email_address'   => 'a@example.com',
        ]);

        $this->assertSame(['id' => 'CUST_X'], $result);
        Http::assertSent(function ($req) {
            return str_ends_with($req->url(), '/v2/customers')
                && $req->method() === 'POST'
                && $req->hasHeader('Authorization', 'Bearer test_token')
                && $req->hasHeader('Square-Version', '2024-10-17')
                && $req['email_address'] === 'a@example.com';
        });
    }

    public function test_createCard_は_verificationToken_を含めてPOST(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/cards' => Http::response([
                'card' => [
                    'id' => 'CARD_X',
                    'card_brand' => 'VISA',
                    'last_4' => '1111',
                    'exp_month' => 12,
                    'exp_year' => 2099,
                ],
            ], 200),
        ]);

        $card = (new SquareClient())->createCard('cnon:src', 'CUST_A', 'ver_tok');

        $this->assertSame('CARD_X', $card['id']);
        Http::assertSent(function ($req) {
            return str_ends_with($req->url(), '/v2/cards')
                && $req['source_id'] === 'cnon:src'
                && $req['verification_token'] === 'ver_tok'
                && ($req['card']['customer_id'] ?? null) === 'CUST_A';
        });
    }

    public function test_createCard_は_verificationTokenなしならbodyに含まれない(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/cards' => Http::response(['card' => ['id' => 'C']], 200),
        ]);

        (new SquareClient())->createCard('src', 'CUST');

        Http::assertSent(fn ($req) => !isset($req->data()['verification_token']));
    }

    public function test_chargeCard_は_amount_money_と_location_id_を含む(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/payments' => Http::response([
                'payment' => ['id' => 'PAY_X', 'status' => 'COMPLETED'],
            ], 200),
        ]);

        $result = (new SquareClient())->chargeCard('CUST', 'CARD', 5000, 'idem-1', [
            'note' => 'unit test',
        ]);

        $this->assertSame('PAY_X', $result['id']);
        Http::assertSent(function ($req) {
            return str_ends_with($req->url(), '/v2/payments')
                && $req['source_id'] === 'CARD'
                && $req['customer_id'] === 'CUST'
                && $req['idempotency_key'] === 'idem-1'
                && $req['amount_money']['amount'] === 5000
                && $req['amount_money']['currency'] === 'JPY'
                && $req['location_id'] === 'LOC_TEST'
                && $req['autocomplete'] === true
                && $req['note'] === 'unit test';
        });
    }

    public function test_disableCard_は_disable_endpoint_へPOST(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/cards/CARD_DEL/disable' => Http::response([], 200),
        ]);

        (new SquareClient())->disableCard('CARD_DEL');

        Http::assertSent(fn ($req) =>
            $req->method() === 'POST' && str_ends_with($req->url(), '/v2/cards/CARD_DEL/disable')
        );
    }

    public function test_disableCard_は_失敗してもLogだけで例外を投げない(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/cards/CARD_FAIL/disable' => Http::response([
                'errors' => [['code' => 'NOT_FOUND']],
            ], 404),
        ]);

        // 例外が投げられないことを確認
        (new SquareClient())->disableCard('CARD_FAIL');
        $this->assertTrue(true);
    }

    public function test_getPayment_は_GET_でPaymentを取得(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/payments/PAY_LOOKUP' => Http::response([
                'payment' => ['id' => 'PAY_LOOKUP', 'status' => 'COMPLETED'],
            ], 200),
        ]);

        $payment = (new SquareClient())->getPayment('PAY_LOOKUP');

        $this->assertSame('PAY_LOOKUP', $payment['id']);
        Http::assertSent(fn ($req) =>
            $req->method() === 'GET' && str_ends_with($req->url(), '/v2/payments/PAY_LOOKUP')
        );
    }

    public function test_refundPayment_は_v2refunds_へPOST(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/refunds' => Http::response([
                'refund' => ['id' => 'REF_X', 'status' => 'COMPLETED'],
            ], 200),
        ]);

        $refund = (new SquareClient())->refundPayment('PAY_X', 1500, '取消');

        $this->assertSame('REF_X', $refund['id']);
        Http::assertSent(function ($req) {
            return str_ends_with($req->url(), '/v2/refunds')
                && $req['payment_id'] === 'PAY_X'
                && $req['amount_money']['amount'] === 1500
                && $req['amount_money']['currency'] === 'JPY'
                && $req['reason'] === '取消';
        });
    }

    public function test_refundPayment_は_理由空なら_reason_キーを送らない(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/refunds' => Http::response(['refund' => ['id' => 'R']], 200),
        ]);

        (new SquareClient())->refundPayment('PAY', 100);
        Http::assertSent(fn ($req) => !isset($req->data()['reason']));
    }

    public function test_ensureOk_は_Square_API_4xx応答でSquareApiException(): void
    {
        Http::fake([
            '*connect.squareupsandbox.com/v2/payments' => Http::response([
                'errors' => [['code' => 'CARD_DECLINED', 'detail' => 'カードが拒否されました']],
            ], 402),
        ]);

        try {
            (new SquareClient())->chargeCard('C', 'CA', 1000, 'k');
            $this->fail('Exception was not thrown');
        } catch (SquareApiException $e) {
            $this->assertSame(402, $e->getCode());
            $this->assertStringContainsString('カードが拒否されました', $e->getMessage());
            $this->assertSame('CARD_DECLINED', $e->errors[0]['code'] ?? null);
        }
    }

    public function test_本番環境では_connect_squareup_com_に飛ぶ(): void
    {
        config(['services.square.environment' => 'production']);
        Http::fake([
            '*connect.squareup.com/v2/customers' => Http::response(['customer' => ['id' => 'P']], 200),
            '*connect.squareupsandbox.com/*'    => Http::response([], 599),
        ]);

        (new SquareClient())->createCustomer(['email_address' => 't@t']);

        Http::assertSent(fn ($req) => str_starts_with($req->url(), 'https://connect.squareup.com/'));
    }

    public function test_verifyWebhookSignature_は_HMAC_SHA256で正しい署名を通す(): void
    {
        $body = '{"hello":"world"}';
        $url = 'https://example.com/wh';
        $key = 'whkey';
        $signature = base64_encode(hash_hmac('sha256', $url . $body, $key, true));

        $client = new SquareClient();
        $this->assertTrue($client->verifyWebhookSignature($body, $signature));
        $this->assertFalse($client->verifyWebhookSignature($body, 'invalid'));
        $this->assertFalse($client->verifyWebhookSignature($body, ''));
    }

    public function test_verifyWebhookSignature_は_設定欠落でfalse(): void
    {
        config(['services.square.webhook_signature_key' => '']);
        $client = new SquareClient();
        $this->assertFalse($client->verifyWebhookSignature('body', 'sig'));
    }
}
