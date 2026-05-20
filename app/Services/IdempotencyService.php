<?php

namespace App\Services;

use App\Models\IdempotencyKey;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;

class IdempotencyService
{
    public const CLAIMED              = 'claimed';
    public const CONFLICT_PROCESSING  = 'conflict_processing';
    public const REPLAY               = 'replay';
    public const PAYLOAD_MISMATCH     = 'payload_mismatch';

    /**
     * 冪等性キーを取得試行する。
     *
     * 戻り値:
     *  - ['result' => CLAIMED]                              新規に予約済み。本処理に進んでよい
     *  - ['result' => CONFLICT_PROCESSING]                  同キーが処理中。クライアントは少し待って再試行
     *  - ['result' => REPLAY, 'status' => int, 'body' => array]  完了済み。保存済みレスポンスを返す
     *  - ['result' => PAYLOAD_MISMATCH]                     同キーで異なるリクエスト本文が来た。仕様違反
     */
    public function claim(string $scope, string $key, string $requestHash): array
    {
        try {
            IdempotencyKey::create([
                'scope'           => $scope,
                'idempotency_key' => $key,
                'request_hash'    => $requestHash,
                'status'          => IdempotencyKey::STATUS_PROCESSING,
                'created_at'      => Carbon::now(),
            ]);
            return ['result' => self::CLAIMED];
        } catch (QueryException $e) {
            if (!$this->isDuplicateKey($e)) {
                throw $e;
            }
        }

        $existing = IdempotencyKey::where('scope', $scope)
            ->where('idempotency_key', $key)
            ->first();

        if (!$existing) {
            // 直前の INSERT は重複だったが、SELECT で見つからない (極めて稀な競合)。安全側で 409 扱い。
            return ['result' => self::CONFLICT_PROCESSING];
        }

        if (!hash_equals($existing->request_hash, $requestHash)) {
            return ['result' => self::PAYLOAD_MISMATCH];
        }

        if ($existing->status === IdempotencyKey::STATUS_COMPLETED) {
            return [
                'result' => self::REPLAY,
                'status' => (int) $existing->response_status,
                'body'   => $existing->response_body ?? [],
            ];
        }

        return ['result' => self::CONFLICT_PROCESSING];
    }

    /**
     * 処理完了を記録する。これ以降の同キー再送は REPLAY として保存内容が返る。
     */
    public function complete(string $scope, string $key, int $status, array $body): void
    {
        IdempotencyKey::where('scope', $scope)
            ->where('idempotency_key', $key)
            ->update([
                'status'          => IdempotencyKey::STATUS_COMPLETED,
                'response_status' => $status,
                'response_body'   => $body,
                'completed_at'    => Carbon::now(),
            ]);
    }

    /**
     * 予約だけして本処理が失敗した場合に予約を解除する。
     * 解除しないと同キーでの再試行が CONFLICT_PROCESSING で止まり続ける。
     */
    public function release(string $scope, string $key): void
    {
        IdempotencyKey::where('scope', $scope)
            ->where('idempotency_key', $key)
            ->where('status', IdempotencyKey::STATUS_PROCESSING)
            ->delete();
    }

    private function isDuplicateKey(QueryException $e): bool
    {
        $sqlState = $e->errorInfo[0] ?? null;
        $driverCode = (int) ($e->errorInfo[1] ?? 0);
        // MySQL: 1062 / SQLite: 19。両者ともに SQLSTATE 23000 を返す。
        return $sqlState === '23000' && in_array($driverCode, [1062, 19], true);
    }
}
