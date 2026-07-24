<?php

namespace App\Jobs;

use App\Models\EneCrmRequest;
use App\Services\Ene\EneCrmClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * E-NE（Cal-Connect）CRM 更新 API への実送信。
 *
 * ⚠ ライブオークション非影響のため notify キューで実行する（countdown キュー厳禁）。
 *   パスワード設定 / 決済登録のリクエストは既に返っており、本処理はここで非同期に走る。
 *
 * 4xx（設定ミス・顧客不在）はリトライしても直らないので即 failed。
 * 5xx / タイムアウトのみ $tries 回まで再試行する。
 */
class SendEneCrmUpdateJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(
        public int $requestId,
    ) {
        $this->onQueue('notify');
    }

    public function handle(EneCrmClient $client): void
    {
        $request = EneCrmRequest::find($this->requestId);

        // 既に成功済み（手動再送との競合など）なら何もしない
        if (!$request || $request->status === EneCrmRequest::STATUS_SUCCESS) {
            return;
        }

        if (!$request->line_user_id) {
            $request->update([
                'status' => EneCrmRequest::STATUS_SKIPPED,
                'error'  => 'line_user_id が未設定です',
            ]);
            return;
        }

        $request->increment('attempts');

        try {
            $response = $client->updateFields(
                $request->line_user_id,
                (array) $request->fields,
                (bool) $request->trigger_automation,
            );
        } catch (\Throwable $e) {
            // 接続不能・タイムアウト。リトライ余地があるので pending のまま投げ直す。
            $this->recordFailure($request, null, $e->getMessage());
            throw $e;
        }

        $status = $response->status();

        if ($response->successful()) {
            $request->update([
                'status'      => EneCrmRequest::STATUS_SUCCESS,
                'http_status' => $status,
                'response'    => Str::limit($response->body(), 1000),
                'error'       => null,
                'sent_at'     => now(),
            ]);
            return;
        }

        $this->recordFailure($request, $status, Str::limit($response->body(), 1000));

        // 401/403/404/422 は再送しても同じ結果になるため、ここで打ち切って管理画面の手動再送に委ねる。
        // 429/5xx はリトライで回復しうるので例外を投げて Job のリトライに乗せる。
        if ($status >= 500 || $status === 429) {
            throw new \RuntimeException("E-NE CRM update failed (HTTP {$status})");
        }
    }

    private function recordFailure(EneCrmRequest $request, ?int $httpStatus, string $error): void
    {
        $request->update([
            'status'      => EneCrmRequest::STATUS_FAILED,
            'http_status' => $httpStatus,
            'error'       => $error,
            'sent_at'     => now(),
        ]);

        Log::warning('EneCrmUpdate failed', [
            'request_id'  => $request->id,
            'event'       => $request->event,
            'user_id'     => $request->user_id,
            'http_status' => $httpStatus,
            'error'       => $error,
        ]);
    }
}
