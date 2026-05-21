<?php

namespace App\Console\Commands;

use App\Models\Auction;
use App\Services\NotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * 開始30分前のオークションを検出して開始予告通知（参加者・出品者）を送る。
 *
 * 動作:
 *  - 「開始日時 ≦ now + 30分」かつ「まだ開始していない（scheduled / preparing 状態）」かつ
 *    `start_notice_sent_at` が NULL のオークションを抽出。
 *  - 通知発火と同時に `start_notice_sent_at = now()` を更新（DBレベルでの冪等性フラグ）。
 *  - 30分前にここで送信できなかった場合は、ProcessAuctionCountdownJob のフォールバックで
 *    開始時に同フラグを参照してリカバリ送信される（保険）。
 *
 * 既存 NotificationService::sendAuctionStartNotification は内部でテストモードフィルタを
 * かけているため、is_test オークション/ユーザーの分離も自動で効く。
 */
class DispatchAuctionStartNotice extends Command
{
    protected $signature = 'auctions:dispatch-start-notice';

    protected $description = '開始30分前のオークションに対して開始予告通知（参加者・出品者）を送信する';

    public function handle(NotificationService $notificationService): int
    {
        $now = now();
        $windowEnd = $now->copy()->addMinutes(30);

        // event_date(date) + start_time(HH:mm) を結合して開始日時を判定する。
        // MySQL/MariaDB の TIMESTAMP/STR_TO_DATE を使うと環境依存になるため、
        // PHP 側で「今日」+「明日早朝開催」だけを対象に絞り込み、開始時刻判定はアプリ層で行う。
        $candidates = Auction::query()
            ->whereIn('status', ['scheduled', 'preparing'])
            ->whereNull('start_notice_sent_at')
            ->where(function ($q) use ($now, $windowEnd) {
                $q->whereDate('event_date', $now->toDateString())
                    ->orWhereDate('event_date', $windowEnd->toDateString());
            })
            ->get();

        if ($candidates->isEmpty()) {
            return 0;
        }

        $dispatched = 0;
        foreach ($candidates as $auction) {
            try {
                $startsAt = $this->resolveStartsAt($auction);
                if ($startsAt === null) {
                    continue;
                }

                // 開始済みは対象外（保険: ProcessAuctionCountdownJob 側のフォールバックが拾う）
                if ($startsAt->lessThanOrEqualTo($now)) {
                    continue;
                }

                // 30分より先の開催は対象外
                if ($startsAt->greaterThan($windowEnd)) {
                    continue;
                }

                // ─── 通知送信 + フラグ更新（原子的に） ───
                // 競合（scheduler 多重起動 / withoutOverlapping 解放直後の再実行など）に備え、
                // UPDATE で start_notice_sent_at が NULL のときだけ NOW() を入れて、
                // affected rows = 1 のときだけ実際の通知を発火させる。
                $updated = DB::table('auctions')
                    ->where('id', $auction->id)
                    ->whereNull('start_notice_sent_at')
                    ->update(['start_notice_sent_at' => now()]);

                if ($updated !== 1) {
                    // 他プロセスが先に取った。スキップ。
                    continue;
                }

                $auction->refresh();

                try {
                    $sentCount = $notificationService->sendAuctionStartNotification($auction);
                    $notificationService->sendSellerAuctionStartNotification($auction);

                    Log::info('auction.start_notice.dispatched', [
                        'auction_id' => $auction->id,
                        'starts_at'  => $startsAt->toIso8601String(),
                        'sent_count' => $sentCount,
                    ]);
                    $dispatched++;
                } catch (\Throwable $e) {
                    // 通知送信に失敗した場合はフラグを戻して次回再試行できるようにする
                    DB::table('auctions')
                        ->where('id', $auction->id)
                        ->update(['start_notice_sent_at' => null]);

                    Log::warning('auction.start_notice.failed_rollback', [
                        'auction_id' => $auction->id,
                        'error'      => $e->getMessage(),
                    ]);
                }
            } catch (\Throwable $e) {
                Log::warning('auction.start_notice.error', [
                    'auction_id' => $auction->id ?? null,
                    'error'      => $e->getMessage(),
                ]);
            }
        }

        if ($dispatched > 0) {
            $this->info("開始予告通知を送信したオークション: {$dispatched}件");
        }

        return 0;
    }

    /**
     * Auction.event_date(date) + Auction.start_time(HH:mm string) を結合して
     * 開始日時の Carbon インスタンスを返す。失敗時は null。
     */
    private function resolveStartsAt(Auction $auction): ?\Carbon\Carbon
    {
        if (!$auction->event_date || !$auction->start_time) {
            return null;
        }

        try {
            $date = $auction->event_date->format('Y-m-d');
            $time = (string) $auction->start_time;
            // start_time は HH:mm 想定だが HH:mm:ss も許容
            if (strlen($time) === 5) {
                $time .= ':00';
            }
            return \Carbon\Carbon::parse("{$date} {$time}", config('app.timezone'));
        } catch (\Throwable $e) {
            return null;
        }
    }
}
