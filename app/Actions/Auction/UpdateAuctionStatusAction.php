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
        private readonly StartAuctionAction  $startAction,
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
        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return ['error' => 'オークションを開始できません。現在のステータスでは開始できません。'];
        }

        if ($auction->items()->where('status', 'registered')->count() === 0) {
            return ['error' => 'オークションを開始できません。承認済みの生体を1件以上登録してください。'];
        }

        // A-7 (2026-09-08): 開始処理は StartAuctionAction に一本化（LiveController::start と同じ入口）。
        //   旧実装はここにも同じ内容の別実装があった。行ロックによる二重起動防止と、
        //   進行ジョブ死亡時の押し直し復旧は StartAuctionAction 側で扱う。
        try {
            $this->startAction->start($auction, ['preparing', 'scheduled'], true);
        } catch (\Illuminate\Database\QueryException $e) {
            Log::error("Failed to start auction via status change (DB)", ['auction_id' => $auction->id, 'error' => $e->getMessage()]);
            return ['error' => 'オークション開始中にエラーが発生しました。ログを確認してください。'];
        } catch (\RuntimeException $e) {
            return ['error' => $e->getMessage()];
        } catch (\Exception $e) {
            Log::error("Failed to start auction via status change", ['auction_id' => $auction->id, 'error' => $e->getMessage()]);
            return ['error' => 'オークション開始中にエラーが発生しました: ' . $e->getMessage()];
        }

        Log::info("Auction started via status change", ['auction_id' => $auction->id]);
        return 'オークションを開始しました。';
    }

    private function toFinishedState(Auction $auction): string|array
    {
        if (!$auction->finish()) {
            return ['error' => 'オークションを終了できません。'];
        }

        try {
            $sentCount = $this->notificationService->sendInvoiceReadyNotification($auction);
            Log::info("請求書発行LINE通知: {$sentCount}件", ['auction_id' => $auction->id]);
        } catch (\Exception $e) {
            Log::warning('請求書発行LINE通知でエラー', ['auction_id' => $auction->id, 'error' => $e->getMessage()]);
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
