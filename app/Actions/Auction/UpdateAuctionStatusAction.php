<?php

namespace App\Actions\Auction;

use App\DTOs\AuctionResultDto;
use App\Models\Auction;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Log;

/**
 * オークションステータス更新アクション（管理者UI用）
 */
class UpdateAuctionStatusAction
{
    private const LABELS = [
        'preparing' => '準備中',
        'scheduled' => '予定（出品受付中）',
        'live'      => '開催中',
        'finished'  => '終了',
        'cancelled' => 'キャンセル',
    ];

    public function __construct(
        private readonly NotificationService $notificationService,
    ) {}

    public function execute(Auction $auction, string $newStatus): AuctionResultDto
    {
        $oldStatus = $auction->status;

        if ($newStatus === $oldStatus) {
            return AuctionResultDto::success(
                'ステータスは既に「' . (self::LABELS[$newStatus] ?? $newStatus) . '」です。',
                ['auction' => $auction->load(['creator:id,name'])]
            );
        }

        $message = match ($newStatus) {
            'preparing' => $this->toPreparingState($auction),
            'scheduled' => $this->toScheduledState($auction, $oldStatus),
            'live'      => $this->toLiveState($auction),
            'finished'  => $this->toFinishedState($auction),
            'cancelled' => $this->toCancelledState($auction),
            default     => null,
        };

        if ($message === null) {
            return AuctionResultDto::failure('不正なステータスです。');
        }

        if (is_array($message)) {
            return AuctionResultDto::failure($message['error']);
        }

        $auction->load(['creator:id,name']);
        return AuctionResultDto::success($message, ['auction' => $auction]);
    }

    private function toPreparingState(Auction $auction): string
    {
        $auction->update(['status' => 'preparing']);
        return 'ステータスを「準備中」に変更しました。';
    }

    private function toScheduledState(Auction $auction, string $oldStatus): string
    {
        $auction->update(['status' => 'scheduled']);

        if ($oldStatus !== 'scheduled') {
            try {
                $sentCount = $this->notificationService->sendNewAuctionNotification($auction);
                Log::info("新規オークション通知送信: {$sentCount}件", ['auction_id' => $auction->id]);
            } catch (\Exception $e) {
                Log::warning('新規オークション通知でエラー', ['error' => $e->getMessage()]);
            }
        }

        return 'ステータスを「予定（出品受付中）」に変更しました。';
    }

    private function toLiveState(Auction $auction): string|array
    {
        if (!$auction->start()) {
            return ['error' => 'オークションを開始できません。承認済みの生体を1件以上登録してください。'];
        }
        return 'オークションを開始しました。';
    }

    private function toFinishedState(Auction $auction): string|array
    {
        if (!$auction->finish()) {
            return ['error' => 'オークションを終了できません。'];
        }
        return 'オークションを終了しました。';
    }

    private function toCancelledState(Auction $auction): string|array
    {
        if (!$auction->cancel()) {
            return ['error' => 'オークションをキャンセルできません。'];
        }
        return 'オークションをキャンセルしました。';
    }
}
