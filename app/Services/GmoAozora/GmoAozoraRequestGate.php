<?php

namespace App\Services\GmoAozora;

use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * GMOあおぞら API への送信を通す関門。
 *
 * 1. 流量制御: 全プロセス共通で「前回送信から min_interval_ms 以上あける」（接続試験の条件: 1秒1リクエスト以下）。
 *    Cache のロックで直列化し、最終送信時刻を Cache に置く（本番/ステージングは Redis なので worker・php-fpm 間で共有される）。
 * 2. 実行ログ: 1リクエスト=1行の JSON を gmo_aozora_api チャネルへ書く（GMO へ提出する「API実行ログ」）。
 *    トークン・client_secret・リクエストボディは書かない。
 */
class GmoAozoraRequestGate
{
    private const LOCK_KEY = 'gmo_aozora:throttle_lock';
    private const LAST_KEY = 'gmo_aozora:last_request_at';

    /**
     * @param  string  $scope    account / transfer / bulk-transfer / virtual-account / auth / webhook
     * @param  string  $context  呼び出し元の論理名（accounts, transferStatus ...）
     * @param  callable(): Response  $send
     */
    public function send(string $scope, string $context, string $method, string $url, callable $send): Response
    {
        $this->throttle();

        $started = microtime(true);
        try {
            $response = $send();
        } catch (ConnectionException $e) {
            $this->log([
                'direction'   => 'outbound',
                'scope'       => $scope,
                'context'     => $context,
                'method'      => strtoupper($method),
                'url'         => $url,
                'status'      => null,
                'duration_ms' => (int) round((microtime(true) - $started) * 1000),
                'error'       => 'connection: ' . mb_substr($e->getMessage(), 0, 200),
            ]);
            throw $e;
        }

        $body = $response->json();
        $body = is_array($body) ? $body : [];
        $this->log([
            'direction'     => 'outbound',
            'scope'         => $scope,
            'context'       => $context,
            'method'        => strtoupper($method),
            'url'           => $url,
            'status'        => $response->status(),
            'duration_ms'   => (int) round((microtime(true) - $started) * 1000),
            'error_code'    => $body['errorCode'] ?? ($body['error'] ?? null),
            'error_message' => $response->successful() ? null : mb_substr((string) ($body['errorMessage'] ?? $body['error_description'] ?? ''), 0, 255),
            'request_id'    => $this->responseRequestId($response),
        ]);

        return $response;
    }

    /**
     * Webhook 受信（inbound）の記録。
     */
    public function logInbound(array $fields): void
    {
        $this->log(['direction' => 'inbound', 'scope' => 'virtual-account'] + $fields);
    }

    /**
     * 前回送信から min_interval_ms 経つまで待つ。
     */
    public function throttle(): void
    {
        $intervalMs = (int) config('services.gmo_aozora.min_interval_ms', 1000);
        if ($intervalMs <= 0) {
            return;
        }

        $wait = function () use ($intervalMs) {
            $last = (float) Cache::get(self::LAST_KEY, 0);
            $remaining = $last + $intervalMs / 1000 - microtime(true);
            if ($remaining > 0) {
                usleep((int) ceil($remaining * 1_000_000));
            }
            Cache::put(self::LAST_KEY, microtime(true), 300);
        };

        try {
            Cache::lock(self::LOCK_KEY, 10)->block(30, $wait);
        } catch (LockTimeoutException) {
            // 30 秒ロックが取れない異常時も、最低 1 間隔は空けてから送る（制限超過を避ける側に倒す）
            usleep($intervalMs * 1000);
            Cache::put(self::LAST_KEY, microtime(true), 300);
        }
    }

    private function log(array $fields): void
    {
        $record = [
            'ts'  => now('Asia/Tokyo')->format('Y-m-d\TH:i:s.vP'),
            'env' => (string) config('services.gmo_aozora.environment', 'development'),
        ] + $fields;

        try {
            Log::channel('gmo_aozora_api')->info(json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        } catch (\Throwable $e) {
            // ログ書き込み失敗で API 処理自体を落とさない（storage/logs 権限事故の教訓）
            Log::warning('GMO Aozora API log write failed', ['error' => $e->getMessage()]);
        }
    }

    private function responseRequestId(Response $response): ?string
    {
        foreach (['x-request-id', 'x-amzn-requestid', 'x-correlation-id', 'request-id'] as $header) {
            $value = $response->header($header);
            if ($value !== '') {
                return mb_substr($value, 0, 128);
            }
        }
        return null;
    }
}
