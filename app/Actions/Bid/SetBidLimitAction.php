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
        private readonly JoinBidAction  $joinBidAction,
        private readonly LeaveBidAction $leaveBidAction,
    ) {}

    /**
     * 指値を設定し、商品がライブ中なら自動入札ONにする（パターンB）
     *
     * ■ 動作:
     *   1. 指値（上限価格）を保存
     *   2. 商品が live 中 → 現在価格 < 指値 → 自動で入札ON（JoinBidAction）
     *   3. 商品が live 中 → 現在価格 >= 指値 → 入札せずに即発動済み
     *   4. 商品が registered（開始前） → 指値のみ保存（オークション開始時に自動入札）
     */
    public function execute(Item $item, int $userId, float $limitPrice): BidResultDto
    {
        if ($limitPrice < 1) {
            return BidResultDto::failure('上限価格は1円以上を設定してください。');
        }

        $item->loadMissing('auction');

        $limit = BidLimitPrice::updateOrCreate(
            ['item_id' => $item->id, 'user_id' => $userId],
            ['limit_price' => $limitPrice, 'is_triggered' => false, 'triggered_at' => null]
        );

        $triggered  = false;
        $autoBidded = false;

        if ($item->status === 'live') {
            if ($item->current_price >= $limitPrice) {
                // 既に上限以上 → 入札せず即発動
                $participant = BidParticipant::forItem($item->id)->forUser($userId)->first();
                if ($participant && $participant->is_active) {
                    $didTrigger = $limit->markAsTriggered();
                    if ($didTrigger) {
                        $this->leaveBidAction->execute($item, $userId);
                        $triggered = true;
                        $this->broadcastLimitReached($item, $userId, $limitPrice);
                    }
                } else {
                    $limit->markAsTriggered();
                    $triggered = true;
                }
            } else {
                // 現在価格 < 指値 → 自動で入札ON
                $participant = BidParticipant::forItem($item->id)->forUser($userId)->first();
                if (!$participant || !$participant->is_active) {
                    $result = $this->joinBidAction->execute($item, $userId);
                    $autoBidded = $result->success;
                }
            }
        }
        // registered の場合は指値のみ保存（オークション開始時に activatePendingBidLimits で自動入札）

        if ($triggered) {
            $message = '上限価格を設定しました（現在価格が上限に達しているため入札しませんでした）';
        } elseif ($autoBidded) {
            $message = '上限価格を設定し、自動で入札に参加しました';
        } else {
            $message = '上限価格を設定しました';
        }

        return BidResultDto::success([
            'item_id'       => $item->id,
            'limit_price'   => $limitPrice,
            'is_triggered'  => $triggered,
            'auto_bidded'   => $autoBidded,
            'quick_options' => $this->buildQuickOptions($item),
        ], $message);
    }

    /**
     * オークション開始時（商品がliveになった時）に、
     * 事前に指値を設定していたユーザーを自動で入札ONにする
     */
    public function activatePendingBidLimits(Item $item): int
    {
        $item->loadMissing('auction');
        if ($item->status !== 'live') return 0;

        $limits = BidLimitPrice::forItem($item->id)
            ->notTriggered()
            ->where('limit_price', '>', $item->current_price)
            ->get();

        $activated = 0;
        foreach ($limits as $limit) {
            $participant = BidParticipant::forItem($item->id)->forUser($limit->user_id)->first();
            if (!$participant || !$participant->is_active) {
                try {
                    $result = $this->joinBidAction->execute($item, $limit->user_id);
                    if ($result->success) $activated++;
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::warning("Auto-bid activation failed: item={$item->id}, user={$limit->user_id} - " . $e->getMessage());
                }
            }
        }

        if ($activated > 0) {
            \Illuminate\Support\Facades\Log::info("Auto-bid activated: item={$item->id}, count={$activated}");
        }

        return $activated;
    }

    public function remove(Item $item, int $userId): BidResultDto
    {
        // 入札中であれば自動で離脱（指値解除 = 自動入札も解除）
        if ($item->status === 'live') {
            $participant = BidParticipant::forItem($item->id)->forUser($userId)->first();
            if ($participant && $participant->is_active) {
                $this->leaveBidAction->execute($item, $userId);
            }
        }

        BidLimitPrice::forItem($item->id)->forUser($userId)->delete();
        return BidResultDto::success([], '上限価格を解除し、入札から離脱しました');
    }

    private function broadcastLimitReached(Item $item, int $userId, float $limitPrice): void
    {
        $lane = Lane::where('current_item_id', $item->id)->first();
        if ($lane && $item->auction) {
            try {
                broadcast(new BidLimitReached(
                    $item->auction->id, $lane->id, $item->id, $userId,
                    $item->current_price, $limitPrice, $item->species_name ?? ''
                ));
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::warning("BidLimitReached broadcast error: " . $e->getMessage());
            }
        }
    }

    private function buildQuickOptions(Item $item): array
    {
        $base = (int) floor($item->status === 'live' ? $item->current_price : $item->start_price);
        return [
            'base_price' => $base,
            'x1_5'       => (int) floor($base * 1.5),
            'x2'         => (int) floor($base * 2),
            'x2_5'       => (int) floor($base * 2.5),
            'x3'         => (int) floor($base * 3),
        ];
    }
}
