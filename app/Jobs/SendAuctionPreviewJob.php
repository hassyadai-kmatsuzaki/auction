<?php

namespace App\Jobs;

use App\Mail\AuctionPreviewMail;
use App\Models\Auction;
use App\Models\User;
use App\Services\TestModeService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * オークション前日予告通知を送信するスケジュールジョブ
 *
 * event_date が翌日のオークション（status = scheduled）に対して
 * 全参加者・全出品者に予告通知を送信する。
 * LINE 通知は SendLineNotificationJob へディスパッチして非同期送信する。
 */
class SendAuctionPreviewJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct()
    {
        $this->onQueue('notify');
    }

    public function handle(TestModeService $testMode): void
    {
        $tomorrow = now()->addDay()->toDateString();

        $auctions = Auction::where('status', 'scheduled')
            ->whereDate('event_date', $tomorrow)
            ->get();

        if ($auctions->isEmpty()) return;

        foreach ($auctions as $auction) {
            // テストモード ON: テストオークションは is_test ユーザーへのみ、本番オークションも is_test ユーザーへのみ
            // テストモード OFF: 通常運用（テストオークションはそもそもこのジョブの対象になりにくいが念のため弾かない）
            $this->notifyUsers($auction, $testMode);
        }
    }

    private function notifyUsers(Auction $auction, TestModeService $testMode): void
    {
        $startTime = $auction->start_time ? " {$auction->start_time}〜" : '';
        $eventDate = $auction->event_date ? $auction->event_date->format('Y/m/d') : '未定';

        $participantLineText = "📅 明日オークションが開催されます！\n"
            . $auction->title . "\n"
            . "開催日: {$eventDate}{$startTime}\n"
            . "お見逃しなく！";

        $sellerLineText = "📅 明日、出品商品のオークションが開催されます\n"
            . $auction->title . "\n"
            . "開催日: {$eventDate}{$startTime}";

        // 参加者（テストモード ON 中は is_test=true のみ）
        $participantQuery = User::whereHas('roles', fn($q) => $q->where('name', 'participant'))
            ->approved();
        $testMode->applyToUserNotificationQuery($participantQuery);
        $participants = $participantQuery->get();

        $sentCount = 0;
        foreach ($participants as $user) {
            try {
                $settings = $user->notification_settings ?? [];
                if ($settings['email_auction_start'] ?? true) {
                    Mail::to($user->email)->queue(new AuctionPreviewMail($auction, $user));
                    $sentCount++;
                }
            } catch (\Exception $e) {
                Log::warning("Auction preview mail error: user={$user->id} - " . $e->getMessage());
            }

            SendLineNotificationJob::dispatch($user->id, 'auction_preview', $participantLineText);
        }

        // 出品者（テストモード ON 中は is_test=true のみ）
        $sellerQuery = User::whereHas('roles', fn($q) => $q->where('name', 'seller'))
            ->approved();
        $testMode->applyToUserNotificationQuery($sellerQuery);
        $sellers = $sellerQuery->get();

        foreach ($sellers as $seller) {
            try {
                $settings = $seller->notification_settings ?? [];
                if ($settings['email_auction_start'] ?? true) {
                    Mail::to($seller->email)->queue(new AuctionPreviewMail($auction, $seller));
                    $sentCount++;
                }
            } catch (\Exception $e) {
                Log::warning("Auction preview mail error: seller={$seller->id} - " . $e->getMessage());
            }

            SendLineNotificationJob::dispatch($seller->id, 'auction_preview', $sellerLineText);
        }

        Log::info("Auction preview notifications sent", [
            'auction_id' => $auction->id,
            'email_count' => $sentCount,
            'participant_count' => $participants->count(),
            'seller_count' => $sellers->count(),
        ]);
    }
}
