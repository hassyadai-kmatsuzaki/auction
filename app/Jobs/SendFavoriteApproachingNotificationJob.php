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
 * お気に入り順番接近のLINE通知を非同期送信するジョブ
 *
 * MoveToNextItemAction → NotifyFavoriteApproachingAction からディスパッチされる。
 * 同期送信だと10人分で2〜5秒ブロックし、500クライアントの画面遷移が遅延するため非同期化。
 */
class SendFavoriteApproachingNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 10;

    public function __construct(
        public int    $userId,
        public string $speciesName,
        public int    $ahead,
        public string $laneName,
        public string $auctionTitle,
    ) {
        $this->onQueue('default');
    }

    public function handle(NotificationService $notificationService): void
    {
        try {
            $notificationService->sendFavoriteApproachingNotification(
                $this->userId,
                $this->speciesName,
                $this->ahead,
                $this->laneName,
                $this->auctionTitle
            );
        } catch (\Exception $e) {
            Log::warning("Favorite notification job error: user={$this->userId} - " . $e->getMessage());
            throw $e; // リトライさせる
        }
    }
}
