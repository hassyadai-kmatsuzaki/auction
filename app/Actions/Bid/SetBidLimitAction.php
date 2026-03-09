<?php

namespace App\Actions\Bid;

use App\DTOs\BidResultDto;
use App\Events\BidderUpdated;
use App\Events\BidLimitReached;
use App\Models\BidLimitPrice;
use App\Models\BidParticipant;
use App\Models\Favorite;
use App\Models\Item;
use App\Models\Lane;
use App\Services\CountdownService;

/**
 * 入札上限価格（指値）を設定・更新するアクション
 */
class SetBidLimitAction
{
    public function __construct(
        private readonly JoinBidAction     $joinBidAction,
        private readonly LeaveBidAction    $leaveBidAction,
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

        Favorite::firstOrCreate(['user_id' => $userId, 'item_id' => $item->id]);

        $triggered  = false;
        $autoBidded = false;

        if ($item->status === 'live') {
            if ($item->current_price >= $limitPrice) {
                // 既に上限以上 → 入札せず即発動 → 指値レコード削除
                $participant = BidParticipant::forItem($item->id)->forUser($userId)->first();
                if ($participant && $participant->is_active) {
                    $didTrigger = $limit->markAsTriggered();
                    if ($didTrigger) {
                        $this->leaveBidAction->execute($item, $userId);
                        $triggered = true;
                        $this->broadcastLimitReached($item, $userId, $limitPrice);
                        $limit->delete();
                    }
                } else {
                    $limit->markAsTriggered();
                    $limit->delete();
                    $triggered = true;
                }
            } else {
                // 現在価格 < 指値 → 自動で入札ON
                $participant = BidParticipant::forItem($item->id)->forUser($userId)->first();
                if (!$participant || !$participant->is_active) {
                    BidParticipant::participate($item->id, $userId, true, null, 'auto-bid-from-limit');
                    \App\Models\BidEvent::recordJoin($item->id, $userId, $item->current_price, null, 'auto-bid-from-limit');
                    $autoBidded = true;

                    $lane = Lane::where('current_item_id', $item->id)->first();
                    if ($lane && $item->auction) {
                        $activeCount = BidParticipant::forItem($item->id)->active()->count();
                        try {
                            broadcast(new BidderUpdated($item->auction->id, $lane->id, $item->id, $activeCount, 'joined'));
                        } catch (\Exception $e) {
                            \Illuminate\Support\Facades\Log::warning("Auto-bid broadcast: " . $e->getMessage());
                        }
                    }
                }

                // 指値2名以上 → 価格を自動調整（既に入札中のユーザーが指値を設定した場合も含む）
                $lane = $lane ?? Lane::where('current_item_id', $item->id)->first();
                if ($lane && $item->auction) {
                    $activeLimitCount = BidLimitPrice::where('item_id', $item->id)
                        ->where('is_triggered', false)
                        ->where('limit_price', '>', $item->current_price)
                        ->count();

                    if ($activeLimitCount >= 2) {
                        try {
                            $countdownService = app(CountdownService::class);
                            $countdownService->adjustPriceByBidLimits($item->fresh(), $item->auction, $lane);
                        } catch (\Exception $e) {
                            \Illuminate\Support\Facades\Log::error("adjustPriceByBidLimits on live limit set: " . $e->getMessage());
                        }
                    } else {
                        // 指値1名 + 手動入札者がいる場合、即座に価格上昇
                        $totalActiveCount = BidParticipant::forItem($item->id)->active()->count();
                        if ($totalActiveCount >= 2) {
                            try {
                                $lane->load('auction');
                                $countdownService = app(CountdownService::class);
                                $countdownService->handleImmediatePriceIncrement($lane, $item->fresh(), $item->auction, $userId);
                            } catch (\Exception $e) {
                                \Illuminate\Support\Facades\Log::error("Immediate price increment on limit set: " . $e->getMessage());
                            }
                        }
                    }
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
     *
     * ■ 注意: JoinBidAction は pre_bid フェーズ中の入札を拒否するため、
     *         ここでは直接 BidParticipant::participate() を使って入札ONにする。
     *         （システムによる自動入札なので pre_bid チェックをバイパスする）
     */
    public function activatePendingBidLimits(Item $item): int
    {
        $item->loadMissing('auction');

        \Illuminate\Support\Facades\Log::info("activatePendingBidLimits called: item={$item->id}, status={$item->status}, price={$item->current_price}");

        if ($item->status !== 'live') {
            \Illuminate\Support\Facades\Log::info("activatePendingBidLimits: item {$item->id} is not live (status={$item->status}), skipping");
            return 0;
        }

        $limits = BidLimitPrice::forItem($item->id)
            ->notTriggered()
            ->where('limit_price', '>', $item->current_price)
            ->get();

        \Illuminate\Support\Facades\Log::info("activatePendingBidLimits: item={$item->id}, found " . $limits->count() . " pending limits");

        $activated = 0;
        foreach ($limits as $limit) {
            try {
                $participant = BidParticipant::forItem($item->id)->forUser($limit->user_id)->first();
                if (!$participant || !$participant->is_active) {
                    // pre_bid チェックをバイパスして直接入札ONにする
                    BidParticipant::participate(
                        $item->id,
                        $limit->user_id,
                        true,
                        null,
                        'auto-bid-from-limit'
                    );

                    \App\Models\BidEvent::recordJoin(
                        $item->id, $limit->user_id, $item->current_price, null, 'auto-bid-from-limit'
                    );

                    // Pusherで全参加者に入札者数の変更を通知
                    $lane = Lane::where('current_item_id', $item->id)->first();
                    if ($lane && $item->auction) {
                        $activeCount = BidParticipant::forItem($item->id)->active()->count();
                        try {
                            broadcast(new BidderUpdated(
                                $item->auction->id, $lane->id, $item->id, $activeCount, 'joined'
                            ));
                        } catch (\Exception $broadcastErr) {
                            \Illuminate\Support\Facades\Log::warning("Auto-bid broadcast error: " . $broadcastErr->getMessage());
                        }
                    }

                    $activated++;
                }
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::warning("Auto-bid activation failed: item={$item->id}, user={$limit->user_id} - " . $e->getMessage());
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
