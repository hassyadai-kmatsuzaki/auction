<?php

namespace App\Services\GmoAozora;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * GMOあおぞらネット銀行 法人 API クライアント（Http ファサード直叩き・Http::fake() 前提）。
 *
 * 仕様: オープンAPI仕様書 法人口座編 v1.8.0 / イベント通知編 v1.8.0
 *  - ベース: https://{api|stg-api}.gmo-aozora.com/ganb/api/corporation/v1
 *  - 認証ヘッダ: x-access-token（OAuth で得た access_token）
 *  - 共通エラー: { errorCode, errorMessage }
 *
 * 申請済み4スコープに対応:
 *   口座        private:account          GET /accounts, /accounts/balances, /accounts/transactions
 *   振込/振替   private:transfer         GET /transfer/status, POST /transfer/request（要 transfer_enabled）
 *   総合振込    private:bulk-transfer    GET /bulktransfer/status, POST /bulktransfer/request（要 transfer_enabled）
 *   振込入金口座 private:virtual-account POST /va/list, GET /va/deposit-transactions, POST /va/issue
 *
 * 送金系（resultCode を伴う更新 API）は資金移動を起こすため、config services.gmo_aozora.transfer_enabled が
 * true でない限り GmoAozoraApiException を投げて呼び出さない。
 */
class GmoAozoraClient
{
    public function __construct(private readonly GmoAozoraOAuthService $oauth)
    {
    }

    public function oauth(): GmoAozoraOAuthService
    {
        return $this->oauth;
    }

    public function environment(): string
    {
        return $this->oauth->environment();
    }

    public function apiBaseUrl(): string
    {
        return $this->oauth->isProduction()
            ? 'https://api.gmo-aozora.com/ganb/api/corporation/v1'
            : 'https://stg-api.gmo-aozora.com/ganb/api/corporation/v1';
    }

    public function webhooksBaseUrl(): string
    {
        return $this->oauth->isProduction()
            ? 'https://api.gmo-aozora.com/ganb/api/webhooks/v1'
            : 'https://stg-api.gmo-aozora.com/ganb/api/webhooks/v1';
    }

    // ------------------------------------------------------------------
    // 口座（private:account）
    // ------------------------------------------------------------------

    /** 口座一覧照会 */
    public function accounts(): array
    {
        return $this->get('/accounts', [], 'accounts');
    }

    /** 残高照会 */
    public function balances(): array
    {
        return $this->get('/accounts/balances', [], 'balances');
    }

    /**
     * 入出金明細照会（円普通預金）
     */
    public function accountTransactions(string $accountId, ?string $dateFrom = null, ?string $dateTo = null, ?string $nextItemKey = null): array
    {
        return $this->get('/accounts/transactions', array_filter([
            'accountId'   => $accountId,
            'dateFrom'    => $dateFrom,
            'dateTo'      => $dateTo,
            'nextItemKey' => $nextItemKey,
        ], fn ($v) => $v !== null && $v !== ''), 'accountTransactions');
    }

    /**
     * 入金口座ID（振込入金口座の親口座）。config 未設定なら /accounts の先頭普通預金。
     */
    public function resolveRaAccountId(): string
    {
        $configured = (string) config('services.gmo_aozora.ra_account_id', '');
        if ($configured !== '') {
            return $configured;
        }
        foreach ($this->accounts()['accounts'] ?? [] as $account) {
            if (in_array($account['accountTypeCode'] ?? '', ['01', '02'], true) && !empty($account['accountId'])) {
                return (string) $account['accountId'];
            }
        }
        throw new GmoAozoraApiException('入金口座ID（GMO_AOZORA_RA_ACCOUNT_ID）を特定できません。', 0, null, [], 'resolveRaAccountId');
    }

    // ------------------------------------------------------------------
    // 振込/振替（private:transfer）
    // ------------------------------------------------------------------

    /**
     * 振込状況照会（一括照会: queryKeyClass=2, 期間指定）
     */
    public function transferStatus(string $accountId, string $dateFrom, string $dateTo, ?string $nextItemKey = null): array
    {
        return $this->get('/transfer/status', array_filter([
            'accountId'     => $accountId,
            'queryKeyClass' => '2',
            'dateFrom'      => $dateFrom,
            'dateTo'        => $dateTo,
            'nextItemKey'   => $nextItemKey,
        ], fn ($v) => $v !== null && $v !== ''), 'transferStatus');
    }

    /**
     * 振込依頼結果照会（申請番号指定）
     */
    public function transferStatusByApplyNo(string $accountId, string $applyNo): array
    {
        return $this->get('/transfer/status', [
            'accountId'     => $accountId,
            'queryKeyClass' => '1',
            'applyNo'       => $applyNo,
        ], 'transferStatusByApplyNo');
    }

    /**
     * 振込依頼（資金移動）。transfer_enabled=true のときだけ実行できる。
     *
     * @param array $body 仕様書 §振込依頼 のリクエストボディ（accountId, transferDesignatedDate, transfers[] ...）
     * @param string|null $idempotencyKey 省略時は UUID v4 を採番（24時間有効）
     */
    public function transferRequest(array $body, ?string $idempotencyKey = null): array
    {
        $this->assertTransferEnabled('transferRequest');
        $key = $idempotencyKey ?: (string) Str::uuid();
        $response = $this->request()->withHeaders(['Idempotency-Key' => $key])->post('/transfer/request', $body);
        $data = $this->ensureOk($response, 'transferRequest');
        Log::channel('audit')->info('GMO_AOZORA_TRANSFER_REQUEST', [
            'idempotency_key' => $key,
            'apply_no'        => $data['applyNo'] ?? null,
            'result_code'     => $data['resultCode'] ?? null,
            'total_amount'    => $body['totalAmount'] ?? ($body['transfers'][0]['transferAmount'] ?? null),
        ]);
        return $data;
    }

    // ------------------------------------------------------------------
    // 総合振込（private:bulk-transfer）
    // ------------------------------------------------------------------

    /**
     * 総合振込状況照会（一括照会: queryKeyClass=2, 期間指定）
     */
    public function bulkTransferStatus(string $accountId, string $dateFrom, string $dateTo, ?string $nextItemKey = null): array
    {
        return $this->get('/bulktransfer/status', array_filter([
            'accountId'     => $accountId,
            'queryKeyClass' => '2',
            'dateFrom'      => $dateFrom,
            'dateTo'        => $dateTo,
            'nextItemKey'   => $nextItemKey,
        ], fn ($v) => $v !== null && $v !== ''), 'bulkTransferStatus');
    }

    /**
     * 総合振込依頼（資金移動）。transfer_enabled=true のときだけ実行できる。
     */
    public function bulkTransferRequest(array $body, ?string $idempotencyKey = null): array
    {
        $this->assertTransferEnabled('bulkTransferRequest');
        $key = $idempotencyKey ?: (string) Str::uuid();
        $response = $this->request()->withHeaders(['Idempotency-Key' => $key])->post('/bulktransfer/request', $body);
        $data = $this->ensureOk($response, 'bulkTransferRequest');
        Log::channel('audit')->info('GMO_AOZORA_BULK_TRANSFER_REQUEST', [
            'idempotency_key' => $key,
            'apply_no'        => $data['applyNo'] ?? null,
            'result_code'     => $data['resultCode'] ?? null,
            'total_count'     => $body['totalCount'] ?? null,
            'total_amount'    => $body['totalAmount'] ?? null,
        ]);
        return $data;
    }

    // ------------------------------------------------------------------
    // 振込入金口座（private:virtual-account）
    // ------------------------------------------------------------------

    /**
     * 振込入金口座_一覧照会
     *
     * @param array $filter raId / vaIdList / vaStatusCodeList / nextItemKey など（仕様書 §振込入金口座_一覧照会）
     */
    public function vaList(array $filter = []): array
    {
        $response = $this->request()->post('/va/list', (object) $filter);
        return $this->ensureOk($response, 'vaList');
    }

    /**
     * 振込入金口座_入金明細照会（raId か vaId のどちらか必須）
     */
    public function vaDepositTransactions(?string $raId, ?string $vaId = null, ?string $dateFrom = null, ?string $dateTo = null, ?string $nextItemKey = null): array
    {
        return $this->get('/va/deposit-transactions', array_filter([
            'raId'        => $raId,
            'vaId'        => $vaId,
            'dateFrom'    => $dateFrom,
            'dateTo'      => $dateTo,
            'nextItemKey' => $nextItemKey,
        ], fn ($v) => $v !== null && $v !== ''), 'vaDepositTransactions');
    }

    /**
     * 振込入金口座_発行（1リクエスト 1,000 口座まで）
     *
     * @param string $vaTypeCode 1=期限型 2=継続型
     */
    public function vaIssue(int $count, string $raId, string $vaTypeCode = '2', ?string $holderNameKana = null): array
    {
        $body = [
            'vaTypeCode'        => $vaTypeCode,
            'issueRequestCount' => (string) max(1, min(1000, $count)),
            'raId'              => $raId,
        ];
        $kana = $holderNameKana ?? (string) config('services.gmo_aozora.va_holder_name_kana', '');
        if ($kana !== '') {
            $body['vaHolderNameKana'] = $kana;
        }
        $response = $this->request()->post('/va/issue', $body);
        $data = $this->ensureOk($response, 'vaIssue');
        Log::channel('audit')->info('GMO_AOZORA_VA_ISSUED', [
            'count' => count($data['vaList'] ?? []),
            'ra_id' => $raId,
        ]);
        return $data;
    }

    // ------------------------------------------------------------------
    // Webhook 配信制御（Basic: client_id:client_secret）
    // ------------------------------------------------------------------

    /**
     * 通知配信制御。$start=true で配信開始、false で配信停止。
     */
    public function webhookSubscribe(bool $start = true, string $eventType = 'va-deposit-transaction'): array
    {
        $response = $this->webhookRequest()->post('/subscribe', [
            'subscribeStatus' => $start ? '1' : '0',
            'eventTypes'      => [['eventType' => $eventType]],
        ]);
        $data = $this->ensureOk($response, 'webhookSubscribe');
        Log::channel('audit')->info('GMO_AOZORA_WEBHOOK_SUBSCRIBE', ['start' => $start, 'event_type' => $eventType]);
        return $data;
    }

    /**
     * 振込入金口座_未送信明細取得（配信停止中の取りこぼし）。無ければ 404 → 空配列。
     *
     * @return array{messages: array<int, array>}
     */
    public function webhookUnsentList(): array
    {
        $response = $this->webhookRequest()->get('/unsentlist/va-deposit-transaction');
        if ($response->status() === 404) {
            return ['messages' => []];
        }
        return $this->ensureOk($response, 'webhookUnsentList');
    }

    // ------------------------------------------------------------------
    // 内部
    // ------------------------------------------------------------------

    private function get(string $path, array $query, string $context): array
    {
        $response = $this->request()->get($path, $query);
        return $this->ensureOk($response, $context);
    }

    private function request(bool $forceRefresh = false): PendingRequest
    {
        return Http::baseUrl($this->apiBaseUrl())
            ->withHeaders([
                'x-access-token' => $this->oauth->accessToken($forceRefresh),
                'Accept'         => 'application/json',
            ])
            ->acceptJson()
            ->asJson()
            ->timeout(30);
    }

    private function webhookRequest(): PendingRequest
    {
        return Http::baseUrl($this->webhooksBaseUrl())
            ->withBasicAuth($this->oauth->clientId(), $this->oauth->clientSecret())
            ->acceptJson()
            ->asJson()
            ->timeout(30);
    }

    private function assertTransferEnabled(string $context): void
    {
        if (!filter_var(config('services.gmo_aozora.transfer_enabled', false), FILTER_VALIDATE_BOOLEAN)) {
            throw new GmoAozoraApiException(
                '送金系 API は無効化されています（GMO_AOZORA_TRANSFER_ENABLED=false）。',
                0, 'TRANSFER_DISABLED', [], $context
            );
        }
    }

    private function ensureOk(Response $response, string $context): array
    {
        if ($response->successful()) {
            $json = $response->json();
            return is_array($json) ? $json : [];
        }

        $body = $response->json();
        $body = is_array($body) ? $body : [];
        $code = $body['errorCode'] ?? null;
        $msg  = $body['errorMessage'] ?? ($body['error_description'] ?? $response->body());

        Log::error('GMO Aozora API error', [
            'context'    => $context,
            'status'     => $response->status(),
            'error_code' => $code,
            'message'    => $msg,
        ]);

        throw new GmoAozoraApiException(
            is_string($msg) && $msg !== '' ? $msg : ('HTTP ' . $response->status()),
            $response->status(),
            is_string($code) ? $code : null,
            $body,
            $context
        );
    }
}
