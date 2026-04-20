<?php

namespace App\Services\Payment;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Square API クライアント（REST API を Http ファサードで直接叩くラッパー）
 *
 * 公式 SDK を使わない理由:
 *  - 依存パッケージ追加なしで動かせる
 *  - 使う API が限定的（customers, cards, payments, refunds）
 *  - Http::fake() でテストが書きやすい
 */
class SquareClient
{
    private string $environment;
    private string $accessToken;
    private string $apiVersion;
    private string $locationId;
    private string $currency;

    public function __construct()
    {
        $this->environment  = config('services.square.environment', 'sandbox');
        $this->accessToken  = (string) config('services.square.access_token');
        $this->apiVersion   = (string) config('services.square.api_version', '2024-10-17');
        $this->locationId   = (string) config('services.square.location_id');
        $this->currency     = (string) config('services.square.currency', 'JPY');
    }

    public function isConfigured(): bool
    {
        return $this->accessToken !== '' && $this->locationId !== '';
    }

    public function currency(): string
    {
        return $this->currency;
    }

    private function baseUrl(): string
    {
        return $this->environment === 'production'
            ? 'https://connect.squareup.com'
            : 'https://connect.squareupsandbox.com';
    }

    private function request(): PendingRequest
    {
        return Http::baseUrl($this->baseUrl())
            ->withHeaders([
                'Square-Version' => $this->apiVersion,
                'Authorization'  => 'Bearer ' . $this->accessToken,
                'Accept'         => 'application/json',
            ])
            ->acceptJson()
            ->asJson()
            ->timeout(30);
    }

    /**
     * Customer 作成
     * @return array{id:string} Square レスポンスの customer 部分
     */
    public function createCustomer(array $params): array
    {
        $response = $this->request()->post('/v2/customers', $params);
        $this->ensureOk($response, 'createCustomer');
        return $response->json('customer') ?? [];
    }

    /**
     * Card on File 作成（source_id は Web Payments SDK から受け取る）
     *
     * @return array{id:string, card_brand?:string, last_4?:string, exp_month?:int, exp_year?:int}
     */
    public function createCard(string $sourceId, string $customerId, ?string $verificationToken = null): array
    {
        $body = [
            'idempotency_key' => (string) Str::uuid(),
            'source_id'       => $sourceId,
            'card'            => [
                'customer_id' => $customerId,
            ],
        ];
        if ($verificationToken) {
            $body['verification_token'] = $verificationToken;
        }

        $response = $this->request()->post('/v2/cards', $body);
        $this->ensureOk($response, 'createCard');
        return $response->json('card') ?? [];
    }

    /**
     * カード削除（無効化）
     */
    public function disableCard(string $cardId): void
    {
        $response = $this->request()->post("/v2/cards/{$cardId}/disable");
        // 既に無効化されていても 200 で返すため、エラーのみ握る
        if ($response->failed()) {
            Log::warning('Square disableCard failed', [
                'card_id' => $cardId,
                'body' => $response->json(),
            ]);
        }
    }

    /**
     * 保存済みカードで即時課金
     *
     * @param int $amount  金額（円。JPYは最小単位=円なので整数そのまま）
     * @return array Square payment オブジェクト
     */
    public function chargeCard(string $customerId, string $cardId, int $amount, string $idempotencyKey, array $extra = []): array
    {
        $body = array_merge([
            'source_id'       => $cardId,
            'idempotency_key' => $idempotencyKey,
            'amount_money'    => [
                'amount'   => $amount,
                'currency' => $this->currency,
            ],
            'customer_id'     => $customerId,
            'location_id'     => $this->locationId,
            'autocomplete'    => true,
        ], $extra);

        $response = $this->request()->post('/v2/payments', $body);
        $this->ensureOk($response, 'chargeCard');
        return $response->json('payment') ?? [];
    }

    public function getPayment(string $paymentId): array
    {
        $response = $this->request()->get("/v2/payments/{$paymentId}");
        $this->ensureOk($response, 'getPayment');
        return $response->json('payment') ?? [];
    }

    public function refundPayment(string $paymentId, int $amount, string $reason = ''): array
    {
        $body = [
            'idempotency_key' => (string) Str::uuid(),
            'payment_id'      => $paymentId,
            'amount_money'    => [
                'amount'   => $amount,
                'currency' => $this->currency,
            ],
        ];
        if ($reason !== '') {
            $body['reason'] = $reason;
        }

        $response = $this->request()->post('/v2/refunds', $body);
        $this->ensureOk($response, 'refundPayment');
        return $response->json('refund') ?? [];
    }

    /**
     * Webhook 署名検証 (Square の公式式: HMAC-SHA256(key, notification_url + body))
     */
    public function verifyWebhookSignature(string $body, string $signatureHeader): bool
    {
        $key = (string) config('services.square.webhook_signature_key');
        $url = (string) config('services.square.webhook_url');

        if ($key === '' || $url === '' || $signatureHeader === '') {
            return false;
        }

        $expected = base64_encode(hash_hmac('sha256', $url . $body, $key, true));
        return hash_equals($expected, $signatureHeader);
    }

    private function ensureOk(Response $response, string $context): void
    {
        if ($response->successful()) {
            return;
        }

        $errors = $response->json('errors') ?? [];
        $first  = $errors[0] ?? [];
        $detail = $first['detail'] ?? $first['code'] ?? $response->body();

        Log::error('Square API error', [
            'context' => $context,
            'status'  => $response->status(),
            'errors'  => $errors,
        ]);

        throw new SquareApiException(
            is_string($detail) ? $detail : json_encode($detail),
            $response->status(),
            $errors
        );
    }
}
