<?php

namespace App\Services;

use App\Actions\Bid\FinalizeBidAction;
use App\Actions\Bid\LeaveBidAction;
use App\Models\Auction;
use App\Models\BidLimitPrice;
use App\Models\Item;
use App\Models\Lane;
use App\Models\BidParticipant;
use App\Events\BidLimitReached;
use App\Events\CountdownTick;
use App\Events\LaneItemChanged;
use App\Events\AuctionStatusChanged;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CountdownService
{
    /**
     * Tick interval in seconds (0.5 = 500ms)
     */
    public const TICK_INTERVAL = 0.5;

    public function __construct(
        private readonly FinalizeBidAction $finalizeBidAction,
        private readonly LeaveBidAction    $leaveBidAction,
    ) {}

    /** @deprecated 後方互換性のため残存 — CountdownService は BidService に依存しない */
    public function setBidService(mixed $bidService): void {}


    /**
     * カウントダウンのキャッシュキーを生成
     */
    protected function getCacheKey(int $laneId): string
    {
        return "countdown:lane:{$laneId}";
    }

    /**
     * カウントダウンを開始
     * 新商品が表示された直後 → 入札者0人なので「通常（default）」秒数を使用
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
        
        $auctionSettings = $auction->getAuctionSettings();
        // 通常カウントダウン（0〜1人入札時）
        $defaultSeconds = $auctionSettings['countdown_seconds_default']
            ?? $auctionSettings['countdown_seconds']
            ?? 10;
        // 競合カウントダウン（2人以上入札時）
        $competitiveSeconds = $auctionSettings['countdown_seconds_competitive'] ?? 1;

        $cacheData = [
            'lane_id' => $lane->id,
            'item_id' => $item->id,
            'auction_id' => $auction->id,
            'phase' => 'bidding',
            'remaining_seconds' => $defaultSeconds,
            'started_at' => now()->timestamp,
            'countdown_seconds' => $defaultSeconds,
            'countdown_seconds_default' => $defaultSeconds,
            'countdown_seconds_competitive' => $competitiveSeconds,
            'countdown_mode' => 'default', // 'default' or 'competitive'
            'is_running' => true,
            'pre_bid_remaining_seconds' => 0,
        ];
        
        // カウントダウン状態をキャッシュに保存
        Cache::put($this->getCacheKey($lane->id), $cacheData, 3600); // 1時間

        Log::info("Countdown started: lane {$lane->id}, item {$item->id}, default={$defaultSeconds}s, competitive={$competitiveSeconds}s");
    }

    /**
     * 入札開始待機フェーズを開始（生体切り替え後の待機）
     */
    public function startPreBidCountdown(Lane $lane): void
    {
        $lane->load(['currentItem', 'auction']);
        
        $item = $lane->currentItem;
        if (!$item) {
            return;
        }

        $auction = $lane->auction;
        if (!$auction) {
            return;
        }

        $auctionSettings = $auction->getAuctionSettings();
        $preBidDelay = $auctionSettings['item_switch_delay_seconds'] ?? 5;
        $defaultSeconds = $auctionSettings['countdown_seconds_default']
            ?? $auctionSettings['countdown_seconds']
            ?? 10;
        $competitiveSeconds = $auctionSettings['countdown_seconds_competitive'] ?? 1;

        // 待機秒数が0の場合は即入札カウントダウンを開始
        if ($preBidDelay <= 0) {
            $this->startCountdown($lane);
            return;
        }

        $cacheData = [
            'lane_id' => $lane->id,
            'item_id' => $item->id,
            'auction_id' => $auction->id,
            'phase' => 'pre_bid',
            'remaining_seconds' => $preBidDelay,
            'started_at' => now()->timestamp,
            'countdown_seconds' => $defaultSeconds,
            'countdown_seconds_default' => $defaultSeconds,
            'countdown_seconds_competitive' => $competitiveSeconds,
            'countdown_mode' => 'default',
            'is_running' => true,
            'pre_bid_remaining_seconds' => $preBidDelay,
        ];

        Cache::put($this->getCacheKey($lane->id), $cacheData, 3600);

        Log::info("Pre-bid countdown started: lane {$lane->id}, item {$item->id}, delay {$preBidDelay}s");
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
     * 価格上昇は入札者2人以上の時に発生するため、競合秒数を使用
     */
    public function resetCountdown(Lane $lane): void
    {
        $state = Cache::get($this->getCacheKey($lane->id));
        if (!$state) {
            return;
        }

        // 競合秒数を使用（価格上昇後 = 入札者2人以上）
        $competitiveSeconds = $state['countdown_seconds_competitive'] ?? 1;

        $state['remaining_seconds'] = $competitiveSeconds;
        $state['countdown_mode'] = 'competitive';
        $state['started_at'] = now()->timestamp;

        Cache::put($this->getCacheKey($lane->id), $state, 3600);

        Log::info("Countdown reset (competitive): lane {$lane->id}, {$competitiveSeconds}s");
    }

    /**
     * カウントダウンをティック（0.5秒進める）
     * キューワーカーから0.5秒ごとに呼ばれる
     *
     * ■ 堅牢性設計:
     *   1. どのパスを通っても必ずキャッシュを更新する（or 明示的にstop/restart）
     *   2. 例外が発生してもレーンが止まらない（catchで復旧を試みる）
     *   3. カウントダウン終了後の moveToNextItem はトランザクション外でカウントダウンを開始
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

        // 入札開始待機フェーズの処理
        $phase = $state['phase'] ?? 'bidding';
        if ($phase === 'pre_bid') {
            return $this->tickPreBid($laneId, $lane, $item, $auction, $state);
        }

        $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();

        // ========= 入札者数に応じた動的カウントダウン切り替え =========
        $currentMode = $state['countdown_mode'] ?? 'default';
        $defaultSeconds = $state['countdown_seconds_default'] ?? 10;
        $competitiveSeconds = $state['countdown_seconds_competitive'] ?? 1;

        if ($activeBidderCount >= 2 && $currentMode === 'default') {
            $state['countdown_mode'] = 'competitive';
            $state['remaining_seconds'] = $competitiveSeconds;
        } elseif ($activeBidderCount < 2 && $currentMode === 'competitive') {
            $state['countdown_mode'] = 'default';
            $state['remaining_seconds'] = $defaultSeconds;
        }

        // カウントダウンを0.5秒減らす
        $state['remaining_seconds'] = max(0, $state['remaining_seconds'] - self::TICK_INTERVAL);

        // ブロードキャスト（0.5秒ごと）
        try {
            broadcast(new CountdownTick(
                $auction->id, $lane->id, $item->id,
                (float) $state['remaining_seconds'],
                $activeBidderCount, $item->current_price
            ));
        } catch (\Exception $e) {
            Log::warning("Broadcast error lane {$laneId}: " . $e->getMessage());
        }

        // カウントダウン終了時の処理
        if ($state['remaining_seconds'] <= 0) {
            if ($activeBidderCount >= 2) {
                // 入札者2人以上 → 価格上昇してカウントダウンリセット
                try {
                    $this->handlePriceIncrement($lane, $item, $auction, $activeBidderCount);
                } catch (\Exception $e) {
                    // 価格上昇が失敗してもレーンを止めない: カウントダウンをリセットして継続
                    Log::error("Price increment FAILED lane {$laneId}: {$e->getMessage()} - resetting countdown");
                    $this->resetCountdown($lane);
                }
                return ['action' => 'price_increment', 'lane_id' => $laneId];
            } else {
                // 入札者0人or1人 → 流札or落札して次へ
                try {
                    return $this->handleCountdownEnd($lane, $item, $auction, $activeBidderCount);
                } catch (\Exception $e) {
                    Log::error("Countdown end FAILED lane {$laneId}: {$e->getMessage()} - attempting recovery");
                    // 復旧: カウントダウンをdefaultに再設定して止まらないようにする
                    $state['remaining_seconds'] = $defaultSeconds;
                    $state['countdown_mode'] = 'default';
                    Cache::put($this->getCacheKey($laneId), $state, 3600);
                    return ['action' => 'recovery', 'lane_id' => $laneId];
                }
            }
        }

        // ★ 重要: どのパスを通っても必ずキャッシュを更新する
        Cache::put($this->getCacheKey($laneId), $state, 3600);

        return ['action' => 'tick', 'remaining_seconds' => $state['remaining_seconds']];
    }

    /**
     * 入札開始待機フェーズのティック処理（0.5秒ごと）
     */
    protected function tickPreBid(int $laneId, Lane $lane, Item $item, Auction $auction, array $state): array
    {
        // 0.5秒減算
        $state['remaining_seconds'] = max(0, $state['remaining_seconds'] - self::TICK_INTERVAL);
        $state['pre_bid_remaining_seconds'] = $state['remaining_seconds'];

        // pre_bidフェーズ用のブロードキャスト（0.5秒ごと）
        broadcast(new CountdownTick(
            $auction->id,
            $lane->id,
            $item->id,
            (float) $state['remaining_seconds'],
            0, // pre_bid中は入札者数0
            $item->current_price,
            'pre_bid' // フェーズ情報
        ));

        if ($state['remaining_seconds'] <= 0) {
            // 待機完了 → 入札カウントダウンに移行（開始時は通常秒数を使用）
            $defaultSeconds = $state['countdown_seconds_default'] ?? $state['countdown_seconds'] ?? 10;
            $state['phase'] = 'bidding';
            $state['remaining_seconds'] = (float) $defaultSeconds;
            $state['countdown_mode'] = 'default';
            $state['pre_bid_remaining_seconds'] = 0;
            $state['started_at'] = now()->timestamp;

            Cache::put($this->getCacheKey($laneId), $state, 3600);

            Log::info("Pre-bid ended, bidding started: lane {$laneId}, item {$item->id}, countdown={$defaultSeconds}s");

            return [
                'action' => 'pre_bid_end',
                'lane_id' => $laneId,
            ];
        }

        Cache::put($this->getCacheKey($laneId), $state, 3600);

        return [
            'action' => 'pre_bid_tick',
            'remaining_seconds' => $state['remaining_seconds'],
        ];
    }

    /**
     * 価格上昇処理（BidServiceに依存せず直接実装）
     */
    protected function handlePriceIncrement(Lane $lane, Item $item, Auction $auction, int $activeBidderCount): void
    {
        if ($item->status !== 'live' || $activeBidderCount <= 1) {
            return;
        }

        DB::beginTransaction();
        try {
            $oldPrice        = $item->current_price;
            $incrementRate   = $auction->getPriceIncrementRate();
            $incrementMin    = $auction->getPriceIncrementMin();
            $increment       = max($oldPrice * ($incrementRate / 100), $incrementMin);
            $newPrice        = $oldPrice + $increment;

            $item->update(['current_price' => $newPrice]);

            \App\Models\PriceEvent::recordAutoIncrement($item->id, $oldPrice, $newPrice, $activeBidderCount);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Price increment error: " . $e->getMessage());
            return;
        }

        // ★ 重要: 価格更新が成功したらまずカウントダウンをリセット
        // これにより、後続の処理で例外が発生してもレーンが止まらない
        $this->resetCountdown($lane);

        $freshItem = $item->fresh();

        try {
            broadcast(new \App\Events\PriceUpdated(
                $auction->id, $lane->id, $item->id,
                $freshItem->current_price, $activeBidderCount,
                $auction->getAuctionSettings()['countdown_seconds'] ?? 3
            ));
        } catch (\Exception $e) {
            Log::warning("PriceUpdated broadcast error: " . $e->getMessage());
        }

        // 価格上昇後に指値チェック（失敗してもカウントダウンは既にリセット済みなので安全）
        try {
            $this->checkBidLimits($lane, $freshItem, $auction);
        } catch (\Exception $e) {
            Log::error("BidLimit check error after price increment: " . $e->getMessage());
        }
    }

    /**
     * 指値（上限価格）チェック
     * 価格上昇後に呼び出し、上限に達した参加者を自動離脱させる
     *
     * ■ N+1対策: whereIn サブクエリで1回のSQLに集約
     * ■ 競合対策: markAsTriggered() に楽観的ロックを使用
     *             → 複数の価格上昇が同時に来ても二重発動しない
     */
    protected function checkBidLimits(Lane $lane, Item $item, Auction $auction): void
    {
        // N+1修正: whereHasの代わりにwhereInサブクエリで1クエリに最適化
        $limits = BidLimitPrice::where('item_id', $item->id)
            ->where('is_triggered', false)
            ->where('limit_price', '<=', $item->current_price) // 上限以下のものだけ取得
            ->whereIn('user_id', function ($q) use ($item) {
                // アクティブな入札者のuser_idのみ
                $q->select('user_id')
                  ->from('bid_participants')
                  ->where('item_id', $item->id)
                  ->where('is_active', true);
            })
            ->get();

        if ($limits->isEmpty()) {
            return;
        }

        foreach ($limits as $limit) {
            // 競合対策: markAsTriggered() は楽観的ロックで二重発動を防ぐ
            // false が返った場合は既に他のプロセスが処理済み
            try {
                $triggered = $limit->markAsTriggered();
                if (!$triggered) {
                    // 既に別プロセスが発動済みのためスキップ
                    continue;
                }

                // 自動離脱（markAsTriggered成功後に実行）
                $this->leaveBidAction->execute($item, $limit->user_id);

                // ブロードキャストはトランザクション外で実行
                broadcast(new BidLimitReached(
                    $auction->id,
                    $lane->id,
                    $item->id,
                    $limit->user_id,
                    $item->current_price,
                    $limit->limit_price,
                    $item->species_name ?? ''
                ));

                Log::info("BidLimit triggered: item={$item->id}, user={$limit->user_id}, price={$item->current_price}, limit={$limit->limit_price}");
            } catch (\Exception $e) {
                Log::error("BidLimit check error: item={$item->id}, user={$limit->user_id} - " . $e->getMessage());
            }
        }
    }

    /**
     * カウントダウン終了処理
     *
     * ■ 修正ポイント:
     *   1. 落札/流札のDB処理はトランザクション内
     *   2. moveToNextItem（次商品のセット + startPreBidCountdown）はトランザクション外
     *      → startPreBidCountdownがCache::putするので、トランザクションrollback時に
     *        キャッシュだけ残って不整合になるのを防ぐ
     */
    protected function handleCountdownEnd(Lane $lane, Item $item, Auction $auction, int $activeBidderCount): array
    {
        $this->stopCountdown($lane->id);

        // Step 1: 落札/流札のDB処理（トランザクション内）
        DB::beginTransaction();
        try {
            if ($activeBidderCount === 0) {
                $item->update(['status' => 'unsold']);
                Log::info("Item {$item->id} unsold");
            } elseif ($activeBidderCount === 1) {
                $this->finalizeBidAction->execute($item);
                Log::info("Item {$item->id} sold");
            }
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Countdown end DB error: " . $e->getMessage());
            throw $e;
        }

        // Step 2: 次の商品への移行（トランザクション外）
        // ここでstartPreBidCountdownが呼ばれてキャッシュが書き込まれる
        // トランザクション外なのでrollbackでキャッシュが不整合になることはない
        $nextItem = null;
        try {
            $nextItem = $this->moveToNextItem($lane, $auction);
        } catch (\Exception $e) {
            Log::error("Move to next item error lane {$lane->id}: " . $e->getMessage());
        }

        return [
            'action'    => 'countdown_end',
            'result'    => $activeBidderCount === 0 ? 'unsold' : 'sold',
            'next_item' => $nextItem ? $nextItem->id : null,
        ];
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

            // レーンをリフレッシュして入札開始待機 → カウントダウンを開始
            $lane->refresh();
            $lane->load(['auction', 'currentItem']);
            $this->startPreBidCountdown($lane);

            // 入札開始待機の残り秒数を取得
            $countdownState = $this->getCountdownState($lane->id);
            $preBidRemaining = ($countdownState && ($countdownState['phase'] ?? '') === 'pre_bid')
                ? $countdownState['remaining_seconds'] : 0;

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
                'pre_bid_remaining_seconds' => $preBidRemaining,
            ];
        } else {
            // 商品がなければレーンを終了
            $lane->update([
                'current_item_id' => null,
                'status' => 'finished',
            ]);
            $currentItemData = null;
            Log::info("Lane {$lane->id} finished - no more items");

            // 全レーンが終了したかチェック → 自動終了
            $this->checkAutoFinishAuction($auction);
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

    /**
     * カウントダウンを一時停止
     */
    public function pauseCountdown(int $laneId): void
    {
        $state = Cache::get($this->getCacheKey($laneId));
        if ($state) {
            $state['is_running'] = false;
            Cache::put($this->getCacheKey($laneId), $state, 3600);
            Log::info("Countdown paused: lane {$laneId}, remaining {$state['remaining_seconds']}s");
        }
    }

    /**
     * カウントダウンを再開（一時停止から復帰）
     */
    public function resumeCountdown(int $laneId): void
    {
        $state = Cache::get($this->getCacheKey($laneId));
        if ($state) {
            $state['is_running'] = true;
            Cache::put($this->getCacheKey($laneId), $state, 3600);
            Log::info("Countdown resumed: lane {$laneId}, remaining {$state['remaining_seconds']}s");
        }
    }

    /**
     * 全レーンが終了したかチェックし、終了していればオークションを自動終了
     */
    protected function checkAutoFinishAuction(Auction $auction): void
    {
        $auction->refresh();
        $auction->load('lanes');

        $allFinished = $auction->lanes->every(function ($lane) {
            return $lane->status === 'finished';
        });

        if ($allFinished && $auction->status === 'live') {
            Log::info("All lanes finished for auction {$auction->id} - auto finishing auction");

            // 残っているライブ商品を不成立にする
            $auction->items()->where('status', 'live')->update(['status' => 'unsold']);

            // オークションを終了
            $auction->update([
                'status' => 'finished',
                'end_time' => now()->format('H:i:s'),
            ]);

            // ステータス変更イベントをブロードキャスト
            broadcast(new AuctionStatusChanged(
                $auction->id,
                'finished',
                'すべての出品が終了しました。オークションが自動終了しました。'
            ));
        }
    }
}
