<?php

namespace App\Actions\Auction;

use App\DTOs\AuctionResultDto;
use App\Events\AuctionStatusChanged;
use App\Models\Auction;
use App\Services\AuctionService;

/**
 * 待機室（入室可否）を管理者が手動で切り替えるアクション
 *
 * scheduled ステータスのオークションに対して、
 * 時間設定に関わらず入室を強制公開 or 閉鎖する。
 */
class ToggleEntranceAction
{
    public function __construct(
        private readonly AuctionService $auctionService,
    ) {}

    /**
     * @param bool $open true=公開（強制入室許可）/ false=閉鎖（時間制御に戻す）
     */
    public function execute(Auction $auction, bool $open): AuctionResultDto
    {
        if ($auction->status !== 'scheduled') {
            return AuctionResultDto::failure(
                '待機室を操作できるのは「予定」ステータスのオークションのみです。（現在: ' . $auction->status . '）'
            );
        }

        if ($open) {
            $this->auctionService->openEntranceManually($auction->id);
            $message = '待機室を公開しました。参加者が入室できます。';
        } else {
            $this->auctionService->closeEntranceManually($auction->id);
            $message = '待機室を閉鎖しました。時間設定に従い入室制御に戻ります。';
        }

        // 参加者画面にリアルタイム通知（状態変化を即時反映）
        broadcast(new AuctionStatusChanged(
            $auction->id,
            'scheduled',
            $open ? '待機室が開放されました。' : '待機室が閉鎖されました。'
        ));

        return AuctionResultDto::success($message, [
            'auction_id'      => $auction->id,
            'entrance_opened' => $open,
        ]);
    }
}
