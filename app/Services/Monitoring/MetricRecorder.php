<?php

namespace App\Services\Monitoring;

use Illuminate\Support\Facades\Log;

/**
 * CloudWatch EMF (Embedded Metric Format) でアプリメトリクスを記録する薄いラッパー。
 *
 * ■ 仕組み
 *   - JSON形式で storage/logs/alerts.log に書き込む
 *   - CloudWatch Logs Agent でこのログを CloudWatch Logs に転送する
 *   - EMFフォーマットの `_aws.CloudWatchMetrics` ブロックを CloudWatch が検出し、
 *     自動でメトリクスを抽出する（PutMetricData API 呼び出し不要・追加コストほぼゼロ）
 *
 * ■ namespace
 *   - すべてのメトリクスは `Auction/App` ネームスペースに集約
 *
 * ■ 参考
 *   - https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format_Specification.html
 */
class MetricRecorder
{
    public const NAMESPACE_APP = 'Auction/App';
    public const CHANNEL = 'alerts';

    /**
     * カウントダウン tick の通常ハートビート（CloudWatch で missing-data 監視に使う）
     */
    public function countdownTick(int $laneId, string $phase, float $remainingSeconds): void
    {
        $this->emit('countdown_tick', [
            ['CountdownTick' => ['Count', 1]],
            ['CountdownRemaining' => ['Seconds', $remainingSeconds]],
        ], [
            'lane_id' => (string) $laneId,
            'phase' => $phase,
        ]);
    }

    /**
     * 価格上昇イベント（上昇幅を一緒に記録 → 異常値検知に使う）
     */
    public function priceIncrement(int $itemId, int $laneId, float $oldPrice, float $newPrice, string $reason): void
    {
        $jump = $newPrice - $oldPrice;
        $ratio = $oldPrice > 0 ? ($jump / $oldPrice) : 0;

        $this->emit('price_increment', [
            ['PriceIncrement' => ['Count', 1]],
            ['PriceJump' => ['None', $jump]],
            ['PriceJumpRatio' => ['None', $ratio]],
        ], [
            'item_id' => (string) $itemId,
            'lane_id' => (string) $laneId,
            'reason' => $reason,
            'old_price' => $oldPrice,
            'new_price' => $newPrice,
        ]);
    }

    /**
     * 価格上昇処理の失敗
     */
    public function priceIncrementFailed(int $itemId, string $errorType, string $message): void
    {
        $this->emit('price_increment_failed', [
            ['PriceIncrementFailure' => ['Count', 1]],
        ], [
            'item_id' => (string) $itemId,
            'error_type' => $errorType,
            'message' => $this->truncate($message, 500),
        ], level: 'error');
    }

    /**
     * 入札失敗（JoinBidAction などの例外）
     */
    public function bidFailure(int $itemId, int $userId, string $errorType, string $message): void
    {
        $this->emit('bid_failure', [
            ['BidFailure' => ['Count', 1]],
        ], [
            'item_id' => (string) $itemId,
            'user_id' => (string) $userId,
            'error_type' => $errorType,
            'message' => $this->truncate($message, 500),
        ], level: 'warning');
    }

    /**
     * ブロードキャスト失敗（Reverb/Pusher 配信エラー）
     */
    public function broadcastFailure(string $eventName, string $message): void
    {
        $this->emit('broadcast_failure', [
            ['BroadcastFailure' => ['Count', 1]],
        ], [
            'event' => $eventName,
            'message' => $this->truncate($message, 500),
        ], level: 'warning');
    }

    /**
     * ジョブ失敗
     */
    public function jobFailure(string $jobName, string $message, array $context = []): void
    {
        $this->emit('job_failure', [
            ['JobFailure' => ['Count', 1]],
        ], array_merge([
            'job' => $jobName,
            'message' => $this->truncate($message, 500),
        ], $context), level: 'error');
    }

    /**
     * 商品落札
     */
    public function itemSold(int $itemId, int $winnerId, float $finalPrice): void
    {
        $this->emit('item_sold', [
            ['ItemSold' => ['Count', 1]],
            ['WinningPrice' => ['None', $finalPrice]],
        ], [
            'item_id' => (string) $itemId,
            'winner_id' => (string) $winnerId,
        ]);
    }

    /**
     * 商品流札
     */
    public function itemUnsold(int $itemId): void
    {
        $this->emit('item_unsold', [
            ['ItemUnsold' => ['Count', 1]],
        ], [
            'item_id' => (string) $itemId,
        ]);
    }

    /**
     * EMFフォーマットでログ出力する
     *
     * @param  string $eventType  イベント識別子
     * @param  array  $metricsSpec  各要素は [名前 => [単位, 値]]
     * @param  array  $properties  追加プロパティ（ディメンション対象にもなる）
     * @param  string $level  Logレベル (info|warning|error)
     */
    private function emit(string $eventType, array $metricsSpec, array $properties, string $level = 'info'): void
    {
        $metricDefs = [];
        $values = [];
        foreach ($metricsSpec as $spec) {
            foreach ($spec as $name => [$unit, $value]) {
                $metricDefs[] = ['Name' => $name, 'Unit' => $unit];
                $values[$name] = $value;
            }
        }

        $payload = array_merge([
            '_aws' => [
                'Timestamp' => (int) (microtime(true) * 1000),
                'CloudWatchMetrics' => [
                    [
                        'Namespace' => self::NAMESPACE_APP,
                        'Dimensions' => [['EventType']],
                        'Metrics' => $metricDefs,
                    ],
                ],
            ],
            'EventType' => $eventType,
        ], $values, $properties);

        try {
            Log::channel(self::CHANNEL)->{$level}(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        } catch (\Throwable $e) {
            // 監視系の失敗は本業務に影響させない
            Log::warning('MetricRecorder emit failed: ' . $e->getMessage());
        }
    }

    private function truncate(string $str, int $max): string
    {
        return mb_strlen($str) > $max ? mb_substr($str, 0, $max) . '…' : $str;
    }
}
