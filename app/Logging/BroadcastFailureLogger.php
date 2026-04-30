<?php

namespace App\Logging;

use App\Services\Monitoring\MetricRecorder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * broadcast 例外のログ抑制ヘルパー。
 *
 * Reverb が瞬断すると tick ごと（0.5秒ごと × レーン数）に WARN が出続け、
 * laravel.log がディスク埋め＆ログ書き込み失敗で tick チェーン全停止する事故がある。
 * （memory: project_countdown_log_permission_fragility.md）
 *
 * このヘルパーは:
 *   1. 同種エラー（イベント名 × メッセージ先頭ハッシュ）は 60 秒に 1 度だけ Log::warning を出す
 *   2. CloudWatch メトリクス（MetricRecorder::broadcastFailure）は毎回送る
 *      → 件数集計はメトリクス側で見る（ログは原因調査用の代表サンプルに徹する）
 */
class BroadcastFailureLogger
{
    public const SUPPRESSION_SECONDS = 60;

    public static function warn(string $eventName, string $message, array $context = []): void
    {
        try {
            app(MetricRecorder::class)->broadcastFailure($eventName, $message);
        } catch (\Throwable $e) {
            // メトリクス送信自体が失敗しても本流を止めない
        }

        $key = 'log_broadcast_fail:' . $eventName . ':' . substr(md5($message), 0, 8);
        if (!Cache::add($key, 1, self::SUPPRESSION_SECONDS)) {
            return;
        }

        Log::warning("Broadcast error [{$eventName}]: {$message}", $context);
    }
}
