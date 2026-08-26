<?php

namespace App\Jobs;

use App\Models\WonItem;
use App\Services\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * 入金催促通知を送信するスケジュールジョブ
 *
 * payment_deadline が 24時間以内 / 1時間以内 の未入金 WonItem を対象にする。
 * 送信は「落札者 × 期限」単位に集約して1通（メール+LINE Flex）にまとめる。
 * Cache による送信済みフラグは従来どおり WonItem 単位なので、
 * 後から窓に入った落札品があればその分だけ追送される（既送分は再送しない）。
 */
class SendPaymentReminderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct()
    {
        $this->onQueue('notify');
    }

    public function handle(NotificationService $notificationService): void
    {
        $now = now();

        // ── 1時間以内に期限が来る落札品 ──
        $oneHourItems = WonItem::where('payment_status', 'pending')
            ->whereNotNull('payment_deadline')
            ->where('payment_deadline', '>', $now)
            ->where('payment_deadline', '<=', $now->copy()->addHour())
            ->with(['item', 'winner'])
            ->get();

        $sent1h = $this->sendGrouped($oneHourItems, '1h', '1時間以内', $notificationService);

        // ── 24時間以内に期限が来る落札品（1時間以内は除外） ──
        $twentyFourHourItems = WonItem::where('payment_status', 'pending')
            ->whereNotNull('payment_deadline')
            ->where('payment_deadline', '>', $now->copy()->addHour())
            ->where('payment_deadline', '<=', $now->copy()->addHours(24))
            ->with(['item', 'winner'])
            ->get();

        $sent24h = $this->sendGrouped($twentyFourHourItems, '24h', '24時間以内', $notificationService);

        if ($sent1h + $sent24h > 0) {
            Log::info("Payment reminders sent: 1h={$sent1h}, 24h={$sent24h}");
        }
    }

    /**
     * 未送信の WonItem を「落札者 × 期限」で集約し、グループごとに1通送る。
     *
     * @param  Collection<int, WonItem>  $wonItems
     * @return int  送信した通数（グループ数）
     */
    private function sendGrouped(Collection $wonItems, string $bucket, string $urgency, NotificationService $notificationService): int
    {
        $sent = 0;

        $pending = $wonItems->reject(fn (WonItem $w) => Cache::has("payment_reminder:{$bucket}:{$w->id}"));

        // 期限が異なる落札品を同じ「期限: mm/dd HH:ii」の1通にまとめないよう、期限も集約キーに含める
        $groups = $pending->groupBy(fn (WonItem $w) => $w->winner_id . ':' . ($w->payment_deadline?->getTimestamp() ?? 0));

        foreach ($groups as $group) {
            $group = $group->values();
            try {
                $notificationService->sendPaymentReminderNotification($group, $urgency);
                foreach ($group as $w) {
                    // 期限まで有効なキャッシュ（期限後は不要なので自動消滅）
                    Cache::put("payment_reminder:{$bucket}:{$w->id}", true, $w->payment_deadline);
                }
                $sent++;
            } catch (\Exception $e) {
                Log::warning("Payment reminder ({$bucket}) failed: won_items=" . $group->pluck('id')->implode(',') . " - " . $e->getMessage());
            }
        }

        return $sent;
    }
}
