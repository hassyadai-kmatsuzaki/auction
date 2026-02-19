<?php

namespace App\Actions\Bid;

use App\DTOs\BidResultDto;
use App\Events\BidLimitReached;
use App\Models\BidLimitPrice;
use App\Models\BidParticipant;
use App\Models\Item;
use App\Models\Lane;

/**
 * 入札上限価格（指値）を設定・更新するアクション
 */
class SetBidLimitAction
{
    public function __construct(
        private readonly LeaveBidAction $leaveBidAction,
    ) {}

    public function execute(Item $item, int $userId, float $limitPrice): BidResultDto
    {
        if ($limitPrice < 1) {
            return BidResultDto::failure('上限価格は1円以上を設定してください。');
        }

        // eager loading: auction リレーションが未ロードの場合に読み込む
        $item->loadMissing('auction');

        // 指値を保存（updateOrCreate は UNIQUE 制約が設定されているため安全）
        $limit = BidLimitPrice::updateOrCreate(
            ['item_id' => $item->id, 'user_id' => $userId],
            ['limit_price' => $limitPrice, 'is_triggered' => false, 'triggered_at' => null]
        );

        $triggered = false;

        // 現在価格が既に指値以上の場合 → 入札中なら即時自動オフ
        if ($item->status === 'live' && $item->current_price >= $limitPrice) {
            $participant = BidParticipant::forItem($item->id)->forUser($userId)->first();
            if ($participant && $participant->is_active) {
                // markAsTriggered を先に実行（楽観的ロック）
                // → 他プロセスと競合しても二重発動しない
                $didTrigger = $limit->markAsTriggered();
                if ($didTrigger) {
                    $this->leaveBidAction->execute($item, $userId);
                    $triggered = true;

                    // 本人に自動オフ通知（トランザクション外でブロードキャスト）
                    $lane = Lane::where('current_item_id', $item->id)->first();
                    if ($lane && $item->auction) {
                        broadcast(new BidLimitReached(
                            $item->auction->id,
                            $lane->id,
                            $item->id,
                            $userId,
                            $item->current_price,
                            $limitPrice,
                            $item->species_name ?? ''
                        ));
                    }
                }
            }
        }

        $message = $triggered
            ? '上限価格を設定しました（現在価格が上限に達しているため自動的に入札オフになりました）'
            : '上限価格を設定しました';

        return BidResultDto::success([
            'item_id'       => $item->id,
            'limit_price'   => $limitPrice,
            'is_triggered'  => $triggered,
            'quick_options' => $this->buildQuickOptions($item),
        ], $message);
    }

    public function remove(Item $item, int $userId): BidResultDto
    {
        BidLimitPrice::forItem($item->id)->forUser($userId)->delete();
        return BidResultDto::success([], '上限価格の設定を解除しました');
    }

    /** クイック入力の選択肢を生成（フロントエンドの補助） */
    private function buildQuickOptions(Item $item): array
    {
        $base = $item->status === 'live' ? $item->current_price : $item->start_price;
        return [
            'base_price' => $base,
            'x1_5'       => (int) floor($base * 1.5),
            'x2'         => (int) floor($base * 2),
            'x2_5'       => (int) floor($base * 2.5),
            'x3'         => (int) floor($base * 3),
        ];
    }
}
