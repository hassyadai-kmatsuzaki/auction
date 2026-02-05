<?php

namespace App\Services;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\BidParticipant;
use App\Events\CountdownTick;
use App\Events\LaneItemChanged;
use App\Events\ItemSold;
use App\Jobs\ProcessCountdownJob;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CountdownService
{
    protected BidService $bidService;

    public function __construct(BidService $bidService)
    {
        $this->bidService = $bidService;
    }

    /**
     * カウントダウンのキャッシュキーを生成
     */
    protected function getCacheKey(int $laneId): string
    {
        return "countdown:lane:{$laneId}";
    }

    /**
     * カウントダウンを開始
     */
    public function startCountdown(Lane $lane): void
    {
        // リレーションをロード
        $lane->load(['currentItem', 'auction']);
        
        $item = $lane->currentItem;
        if (!$item) {
            return;
        }

        $auction = $lane->auction;
        if (!$auction) {
            return;
        }
        
        $countdownSeconds = $auction->getAuctionSettings()['countdown_seconds'] ?? 3;

        $cacheData = [
            'lane_id' => $lane->id,
            'item_id' => $item->id,
            'auction_id' => $auction->id,
            'remaining_seconds' => $countdownSeconds,
            'started_at' => now()->timestamp,
            'countdown_seconds' => $countdownSeconds,
            'is_running' => true,
        ];
        
        // カウントダウン状態をキャッシュに保存
        Cache::put($this->getCacheKey($lane->id), $cacheData, 3600); // 1時間

        Log::info("Countdown started: lane {$lane->id}, item {$item->id}");
    }

    /**
     * カウントダウンを停止
     */
    public function stopCountdown(int $laneId): void
    {
        Cache::forget($this->getCacheKey($laneId));
    }

    /**
     * カウントダウンをリセット（価格上昇時）
     */
    public function resetCountdown(Lane $lane): void
    {
        $state = Cache::get($this->getCacheKey($lane->id));
        if (!$state) {
            return;
        }

        $auction = $lane->auction;
        $countdownSeconds = $auction->getAuctionSettings()['countdown_seconds'] ?? 3;

        $state['remaining_seconds'] = $countdownSeconds;
        $state['started_at'] = now()->timestamp;

        Cache::put($this->getCacheKey($lane->id), $state, 3600);
    }

    /**
     * カウントダウンをティック（1秒進める）
     * キューワーカーから毎秒呼ばれる
     */
    public function tick(int $laneId): ?array
    {
        $state = Cache::get($this->getCacheKey($laneId));
        if (!$state || !$state['is_running']) {
            return null;
        }

        $lane = Lane::with(['auction', 'currentItem'])->find($laneId);
        if (!$lane || !$lane->currentItem || $lane->currentItem->status !== 'live') {
            $this->stopCountdown($laneId);
            return null;
        }

        $item = $lane->currentItem;
        $auction = $lane->auction;
        $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();

        // カウントダウンを1秒減らす
        $state['remaining_seconds']--;
        
        // ブロードキャスト（毎秒）
        broadcast(new CountdownTick(
            $auction->id,
            $lane->id,
            $item->id,
            $state['remaining_seconds'],
            $activeBidderCount,
            $item->current_price
        ));

        // カウントダウン終了時の処理
        if ($state['remaining_seconds'] <= 0) {
            if ($activeBidderCount >= 2) {
                // 入札者2人以上 → 価格上昇してカウントダウンリセット
                $this->handlePriceIncrement($lane, $item, $auction, $activeBidderCount);
                return [
                    'action' => 'price_increment',
                    'lane_id' => $laneId,
                ];
            } else {
                // 入札者0人or1人 → 流札or落札して次へ
                return $this->handleCountdownEnd($lane, $item, $auction, $activeBidderCount);
            }
        }

        // 状態を更新
        Cache::put($this->getCacheKey($laneId), $state, 3600);

        return [
            'action' => 'tick',
            'remaining_seconds' => $state['remaining_seconds'],
        ];
    }

    /**
     * 価格上昇処理
     */
    protected function handlePriceIncrement(Lane $lane, Item $item, Auction $auction, int $activeBidderCount): void
    {
        // 価格上昇
        $result = $this->bidService->incrementPrice($item);
        
        if ($result['success']) {
            // カウントダウンをリセット
            $this->resetCountdown($lane);
        }
    }

    /**
     * カウントダウン終了処理
     */
    protected function handleCountdownEnd(Lane $lane, Item $item, Auction $auction, int $activeBidderCount): array
    {
        $this->stopCountdown($lane->id);

        DB::beginTransaction();
        try {
            if ($activeBidderCount === 0) {
                // 入札者0人 → 流札
                $item->update(['status' => 'unsold']);
                Log::info("Item {$item->id} unsold");
            } elseif ($activeBidderCount === 1) {
                // 入札者1人 → 落札（finalizeBid内でItemSoldがブロードキャストされる）
                $this->bidService->finalizeBid($item);
                Log::info("Item {$item->id} sold");
            }

            // 次の商品へ
            $nextItem = $this->moveToNextItem($lane, $auction);

            DB::commit();

            return [
                'action' => 'countdown_end',
                'result' => $activeBidderCount === 0 ? 'unsold' : 'sold',
                'next_item' => $nextItem ? $nextItem->id : null,
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Countdown end error: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * 次の商品に移動
     */
    protected function moveToNextItem(Lane $lane, Auction $auction): ?Item
    {
        $previousItemId = $lane->current_item_id;

        // 次の商品を取得
        $nextItem = $lane->items()
            ->where('status', 'registered')
            ->orderBy('lane_items.sequence_order')
            ->first();

        if ($nextItem) {
            // 商品をライブに
            $nextItem->update([
                'status' => 'live',
                'current_price' => $nextItem->start_price,
            ]);

            // レーンの現在商品を更新
            $lane->update([
                'current_item_id' => $nextItem->id,
                'status' => 'active',
            ]);

            // レーンをリフレッシュして新しいカウントダウンを開始
            $lane->refresh();
            $lane->load(['auction', 'currentItem']);
            $this->startCountdown($lane);

            $activeBidderCount = 0; // 新商品なので0
            $currentItemData = [
                'id' => $nextItem->id,
                'item_number' => $nextItem->item_number,
                'species_name' => $nextItem->species_name,
                'quantity' => $nextItem->quantity,
                'current_price' => $nextItem->current_price,
                'is_premium' => $nextItem->is_premium,
                'thumbnail_path' => $nextItem->thumbnail_path,
                'active_bidders_count' => $activeBidderCount,
            ];
        } else {
            // 商品がなければレーンを終了
            $lane->update([
                'current_item_id' => null,
                'status' => 'finished',
            ]);
            $currentItemData = null;
            Log::info("Lane {$lane->id} finished - no more items");
        }

        // レーン変更イベントをブロードキャスト
        broadcast(new LaneItemChanged(
            $auction->id,
            $lane->id,
            $lane->lane_number,
            $previousItemId,
            $currentItemData
        ));

        return $nextItem;
    }

    /**
     * 全アクティブレーンのカウントダウン状態を取得
     */
    public function getActiveCountdowns(int $auctionId): array
    {
        $auction = Auction::with('lanes')->find($auctionId);
        if (!$auction) {
            return [];
        }

        $countdowns = [];
        foreach ($auction->lanes as $lane) {
            $state = Cache::get($this->getCacheKey($lane->id));
            if ($state && $state['is_running']) {
                $countdowns[$lane->id] = $state;
            }
        }

        return $countdowns;
    }

    /**
     * レーンのカウントダウン状態を取得
     */
    public function getCountdownState(int $laneId): ?array
    {
        return Cache::get($this->getCacheKey($laneId));
    }
}
