<?php

namespace App\Jobs;

use App\Services\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * 指値発動時の通知（LINE/Mail）を chunk 単位で非同期送信するジョブ。
 *
 * 設計意図（実装書 B9）:
 *   adjustPriceByBidLimits の foreach 内で同期 sendBidLimitReachedNotification
 *   を回すと、100 名同時 cancel 時に items.lockForUpdate を 5〜10 秒保持してしまう。
 *   このジョブで非同期化し、items lock を即座に解放できるようにする。
 *
 *   chunk size = 20 ユーザー / Job （SES TPS 制限と LINE rate limit 対策）。
 *   notify queue で worker 2 個が並列処理する想定。
 */
class NotifyBidLimitChunkJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 60;

    /**
     * @param int    $itemId
     * @param string $speciesName
     * @param float  $currentPrice
     * @param array  $chunk  各要素に _notify_user_id / _notify_limit を持つ
     */
    public function __construct(
        public int    $itemId,
        public string $speciesName,
        public float  $currentPrice,
        public array  $chunk,
    ) {
        $this->onQueue('notify');
    }

    public function handle(NotificationService $notificationService): void
    {
        foreach ($this->chunk as $t) {
            $userId     = $t['_notify_user_id'] ?? null;
            $limitPrice = $t['_notify_limit'] ?? null;
            if (!$userId || $limitPrice === null) {
                continue;
            }
            try {
                $notificationService->sendBidLimitReachedNotification(
                    (int) $userId,
                    $this->speciesName,
                    (float) $limitPrice,
                    $this->currentPrice,
                );
            } catch (\Throwable $e) {
                Log::warning("NotifyBidLimitChunkJob: notify failed user={$userId} - " . $e->getMessage());
            }
        }
    }
}
