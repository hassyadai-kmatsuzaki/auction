<?php

namespace App\Jobs;

use App\Models\WonItem;
use App\Services\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * 入金催促通知を送信するスケジュールジョブ
 *
 * payment_deadline が 24時間以内 / 1時間以内 の未入金 WonItem に対して通知を送信する。
 * Cache による送信済みフラグで、同じ urgency レベルの通知は WonItem 1件につき1回のみ送信する。
 */
class SendPaymentReminderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct()
    {
        $this->onQueue('default');
    }

    public function handle(NotificationService $notificationService): void
    {
        $now = now();
        $sentCount = ['1h' => 0, '24h' => 0];

        // ── 1時間以内に期限が来る落札品 ──
        $oneHourItems = WonItem::where('payment_status', 'pending')
            ->whereNotNull('payment_deadline')
            ->where('payment_deadline', '>', $now)
            ->where('payment_deadline', '<=', $now->copy()->addHour())
            ->get();

        foreach ($oneHourItems as $wonItem) {
            $cacheKey = "payment_reminder:1h:{$wonItem->id}";
            if (Cache::has($cacheKey)) continue;

            try {
                $notificationService->sendPaymentReminderNotification($wonItem, '1時間以内');
                // 期限まで有効なキャッシュ（期限後は不要なので自動消滅）
                Cache::put($cacheKey, true, $wonItem->payment_deadline);
                $sentCount['1h']++;
            } catch (\Exception $e) {
                Log::warning("Payment reminder (1h) failed: won_item={$wonItem->id} - " . $e->getMessage());
            }
        }

        // ── 24時間以内に期限が来る落札品（1時間以内は除外） ──
        $twentyFourHourItems = WonItem::where('payment_status', 'pending')
            ->whereNotNull('payment_deadline')
            ->where('payment_deadline', '>', $now->copy()->addHour())
            ->where('payment_deadline', '<=', $now->copy()->addHours(24))
            ->get();

        foreach ($twentyFourHourItems as $wonItem) {
            $cacheKey = "payment_reminder:24h:{$wonItem->id}";
            if (Cache::has($cacheKey)) continue;

            try {
                $notificationService->sendPaymentReminderNotification($wonItem, '24時間以内');
                Cache::put($cacheKey, true, $wonItem->payment_deadline);
                $sentCount['24h']++;
            } catch (\Exception $e) {
                Log::warning("Payment reminder (24h) failed: won_item={$wonItem->id} - " . $e->getMessage());
            }
        }

        $total = $sentCount['1h'] + $sentCount['24h'];
        if ($total > 0) {
            Log::info("Payment reminders sent: 1h={$sentCount['1h']}, 24h={$sentCount['24h']}");
        }
    }
}
