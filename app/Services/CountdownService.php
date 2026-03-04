<?php

namespace App\Services;

use App\Actions\Bid\FinalizeBidAction;
use App\Actions\Bid\LeaveBidAction;
use App\Actions\Bid\SetBidLimitAction;
use App\Actions\Line\NotifyFavoriteApproachingAction;
use App\Models\Auction;
use App\Models\BidLimitPrice;
use App\Models\Item;
use App\Models\Lane;
use App\Models\BidParticipant;
use App\Events\BidderUpdated;
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
        private readonly FinalizeBidAction                $finalizeBidAction,
        private readonly LeaveBidAction                   $leaveBidAction,
        private readonly SetBidLimitAction                $setBidLimitAction,
        private readonly NotifyFavoriteApproachingAction  $favoriteNotifyAction,
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
     * 新商品が表示された直後 → 落札カウントダウンを使用
     */
    public function startCountdown(Lane $lane): void
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
        $bidSeconds    = (float) ($auctionSettings['bid_countdown_seconds'] ?? 5);
        $freezeSeconds = (float) ($auctionSettings['freeze_countdown_seconds'] ?? 1);

        $cacheData = [
            'lane_id' => $lane->id,
            'item_id' => $item->id,
            'auction_id' => $auction->id,
            'phase' => 'bidding',
            'remaining_seconds' => $bidSeconds,
            'started_at' => now()->timestamp,
            'bid_countdown_seconds' => $bidSeconds,
            'freeze_countdown_seconds' => $freezeSeconds,
            'is_running' => true,
            'pre_bid_remaining_seconds' => 0,
        ];
        
        Cache::put($this->getCacheKey($lane->id), $cacheData, 3600);

        Log::info("Countdown started: lane {$lane->id}, item {$item->id}, bid={$bidSeconds}s, freeze={$freezeSeconds}s");
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
        $preBidDelay   = (float) ($auctionSettings['item_switch_delay_seconds'] ?? 5);
        $bidSeconds    = (float) ($auctionSettings['bid_countdown_seconds'] ?? 5);
        $freezeSeconds = (float) ($auctionSettings['freeze_countdown_seconds'] ?? 1);

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
            'bid_countdown_seconds' => $bidSeconds,
            'freeze_countdown_seconds' => $freezeSeconds,
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
     * 価格上昇後にフリーズカウントダウンを開始
     * フリーズ → 落札カウントダウンの2段階
     */
    public function startFreezeCountdown(Lane $lane): void
    {
        $state = Cache::get($this->getCacheKey($lane->id));
        if (!$state) {
            return;
        }

        $freezeSeconds = (float) ($state['freeze_countdown_seconds'] ?? 1);

        $state['phase'] = 'freeze';
        $state['remaining_seconds'] = $freezeSeconds;
        $state['started_at'] = now()->timestamp;

        Cache::put($this->getCacheKey($lane->id), $state, 3600);

        Log::info("Freeze countdown started: lane {$lane->id}, {$freezeSeconds}s");
    }

    /**
     * フリーズ終了後に落札カウントダウンを開始
     */
    public function startBidCountdown(Lane $lane): void
    {
        $state = Cache::get($this->getCacheKey($lane->id));
        if (!$state) {
            return;
        }

        $bidSeconds = (float) ($state['bid_countdown_seconds'] ?? 5);

        $state['phase'] = 'bidding';
        $state['remaining_seconds'] = $bidSeconds;
        $state['started_at'] = now()->timestamp;

        Cache::put($this->getCacheKey($lane->id), $state, 3600);

        Log::info("Bid countdown started: lane {$lane->id}, {$bidSeconds}s");
    }

    /**
     * @deprecated 後方互換用 — startFreezeCountdown を使用
     */
    public function resetCountdown(Lane $lane): void
    {
        $this->startFreezeCountdown($lane);
    }

    /**
     * カウントダウンをティック（0.5秒進める）
     * キューワーカーから0.5秒ごとに呼ばれる
     *
     * ■ 堅牢性設計:
     *   1. どのパスを通っても必ずキャッシュを更新する（or 明示的にstop/restart）
     *   2. 例外が発生してもレーンが止まらない（catchで復旧を試みる）
     *   3. カウントダウン終了後の moveToNextItem はトランザクション外でカウントダウンを開始
     *
     * ■ 2段階カウントダウン:
     *   phase: 'pre_bid' → 'freeze' → 'bidding' → (落札/流札)
     *   - pre_bid: 商品切り替え後の待機
     *   - freeze: 誤タップ防止（ボタン無効化）
     *   - bidding: 入札受付カウントダウン
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

        $phase = $state['phase'] ?? 'bidding';

        // 入札開始待機フェーズ
        if ($phase === 'pre_bid') {
            return $this->tickPreBid($laneId, $lane, $item, $auction, $state);
        }

        // フリーズ（誤タップ防止）フェーズ
        if ($phase === 'freeze') {
            return $this->tickFreeze($laneId, $lane, $item, $auction, $state);
        }

        // ========= 入札カウントダウンフェーズ（bidding） =========
        $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();

        // オークション設定の同期（途中変更対応）
        $liveSettings      = $auction->getAuctionSettings();
        $latestBid         = (float) ($liveSettings['bid_countdown_seconds'] ?? 5);
        $latestFreeze      = (float) ($liveSettings['freeze_countdown_seconds'] ?? 1);

        if (($state['bid_countdown_seconds'] ?? null) != $latestBid) {
            $state['bid_countdown_seconds']    = $latestBid;
            $state['freeze_countdown_seconds'] = $latestFreeze;
        }

        // カウントダウンを0.5秒減らす
        $state['remaining_seconds'] = max(0, $state['remaining_seconds'] - self::TICK_INTERVAL);

        try {
            broadcast(new CountdownTick(
                $auction->id, $lane->id, $item->id,
                (float) $state['remaining_seconds'],
                $activeBidderCount, $item->current_price,
                'bidding'
            ));
        } catch (\Exception $e) {
            Log::warning("Broadcast error lane {$laneId}: " . $e->getMessage());
        }

        // カウントダウン終了時の処理
        if ($state['remaining_seconds'] <= 0) {
            if ($activeBidderCount >= 2) {
                // 入札者2人以上 → 価格上昇 → フリーズカウントダウン
                // 最後に入札した人を落札権利者として他を自動離脱
                try {
                    $lastBidder = $state['last_bidder_user_id'] ?? null;
                    $this->handlePriceIncrement($lane, $item, $auction, $activeBidderCount, $lastBidder);
                } catch (\Exception $e) {
                    Log::error("Price increment FAILED lane {$laneId}: {$e->getMessage()} - starting freeze");
                    $this->startFreezeCountdown($lane);
                }
                return ['action' => 'price_increment', 'lane_id' => $laneId];
            } else {
                // 入札者0人or1人 → 流札or落札して次へ
                try {
                    return $this->handleCountdownEnd($lane, $item, $auction, $activeBidderCount);
                } catch (\Exception $e) {
                    Log::error("Countdown end FAILED lane {$laneId}: {$e->getMessage()} - attempting recovery");
                    $bidSeconds = (float) ($state['bid_countdown_seconds'] ?? 5);
                    $state['remaining_seconds'] = $bidSeconds;
                    $state['phase'] = 'bidding';
                    Cache::put($this->getCacheKey($laneId), $state, 3600);
                    return ['action' => 'recovery', 'lane_id' => $laneId];
                }
            }
        }

        Cache::put($this->getCacheKey($laneId), $state, 3600);

        return ['action' => 'tick', 'remaining_seconds' => $state['remaining_seconds']];
    }

    /**
     * 入札開始待機フェーズのティック処理（0.5秒ごと）
     */
    protected function tickPreBid(int $laneId, Lane $lane, Item $item, Auction $auction, array $state): array
    {
        $state['remaining_seconds'] = max(0, $state['remaining_seconds'] - self::TICK_INTERVAL);
        $state['pre_bid_remaining_seconds'] = $state['remaining_seconds'];

        broadcast(new CountdownTick(
            $auction->id, $lane->id, $item->id,
            (float) $state['remaining_seconds'],
            0, $item->current_price,
            'pre_bid'
        ));

        if ($state['remaining_seconds'] <= 0) {
            $bidSeconds = (float) ($state['bid_countdown_seconds'] ?? 5);
            $state['phase'] = 'bidding';
            $state['remaining_seconds'] = $bidSeconds;
            $state['pre_bid_remaining_seconds'] = 0;
            $state['started_at'] = now()->timestamp;

            Cache::put($this->getCacheKey($laneId), $state, 3600);

            Log::info("Pre-bid ended, bidding started: lane {$laneId}, item {$item->id}, countdown={$bidSeconds}s");

            return ['action' => 'pre_bid_end', 'lane_id' => $laneId];
        }

        Cache::put($this->getCacheKey($laneId), $state, 3600);

        return ['action' => 'pre_bid_tick', 'remaining_seconds' => $state['remaining_seconds']];
    }

    /**
     * フリーズ（誤タップ防止）フェーズのティック処理（0.5秒ごと）
     * フリーズ中は入札ボタンが無効化される
     */
    protected function tickFreeze(int $laneId, Lane $lane, Item $item, Auction $auction, array $state): array
    {
        $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();

        $state['remaining_seconds'] = max(0, $state['remaining_seconds'] - self::TICK_INTERVAL);

        broadcast(new CountdownTick(
            $auction->id, $lane->id, $item->id,
            (float) $state['remaining_seconds'],
            $activeBidderCount, $item->current_price,
            'freeze'
        ));

        if ($state['remaining_seconds'] <= 0) {
            $bidSeconds = (float) ($state['bid_countdown_seconds'] ?? 5);
            $state['phase'] = 'bidding';
            $state['remaining_seconds'] = $bidSeconds;
            $state['started_at'] = now()->timestamp;

            Cache::put($this->getCacheKey($laneId), $state, 3600);

            Log::info("Freeze ended, bid countdown started: lane {$laneId}, item {$item->id}, countdown={$bidSeconds}s");

            return ['action' => 'freeze_end', 'lane_id' => $laneId];
        }

        Cache::put($this->getCacheKey($laneId), $state, 3600);

        return ['action' => 'freeze_tick', 'remaining_seconds' => $state['remaining_seconds']];
    }

    /**
     * 価格上昇処理（金額帯別上昇幅テーブル対応）
     *
     * 入札者2人以上 → 即座に価格上昇 → フリーズカウントダウン開始
     */
    protected function handlePriceIncrement(Lane $lane, Item $item, Auction $auction, int $activeBidderCount, ?int $lastBidderUserId = null): void
    {
        if ($item->status !== 'live' || $activeBidderCount <= 1) {
            return;
        }

        DB::beginTransaction();
        try {
            $oldPrice  = $item->current_price;
            $increment = $auction->calculatePriceIncrement($oldPrice);
            $newPrice  = $oldPrice + $increment;

            $item->update(['current_price' => $newPrice]);

            \App\Models\PriceEvent::recordAutoIncrement($item->id, $oldPrice, $newPrice, $activeBidderCount);

            // 落札権利者（最後に入札した人）以外を自動離脱
            $autoLeftUserIds = [];
            if ($lastBidderUserId) {
                $othersToLeave = BidParticipant::forItem($item->id)
                    ->active()
                    ->where('user_id', '!=', $lastBidderUserId)
                    ->get();

                foreach ($othersToLeave as $participant) {
                    $participant->deactivate();
                    $autoLeftUserIds[] = $participant->user_id;
                }

                if (count($autoLeftUserIds) > 0) {
                    Log::info("Auto-left users on price increment: item={$item->id}, left=" . implode(',', $autoLeftUserIds) . ", holder={$lastBidderUserId}");
                }
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Price increment error: " . $e->getMessage());
            return;
        }

        // 価格更新成功 → フリーズカウントダウン開始
        $this->startFreezeCountdown($lane);

        $freshItem = $item->fresh();
        $newActiveBidderCount = BidParticipant::forItem($item->id)->active()->count();

        try {
            broadcast(new \App\Events\PriceUpdated(
                $auction->id, $lane->id, $item->id,
                $freshItem->current_price, $newActiveBidderCount,
                $auction->getBidCountdownSeconds(),
                $autoLeftUserIds
            ));
        } catch (\Exception $e) {
            Log::warning("PriceUpdated broadcast error: " . $e->getMessage());
        }

        // 自動離脱を全クライアントに通知（入札者数の同期）
        if (count($autoLeftUserIds) > 0) {
            try {
                broadcast(new BidderUpdated(
                    $auction->id, $lane->id, $item->id,
                    $newActiveBidderCount, 'left'
                ));
            } catch (\Exception $e) {
                Log::warning("Auto-left BidderUpdated broadcast error: " . $e->getMessage());
            }
        }

        try {
            $this->checkBidLimits($lane, $freshItem, $auction);
        } catch (\Exception $e) {
            Log::error("BidLimit check error after price increment: " . $e->getMessage());
        }
    }

    /**
     * 入札者が参加した際の即時価格上昇処理
     *
     * 入札者が2人以上になった瞬間に呼ばれる:
     * 1. 即座に価格を上昇
     * 2. フリーズカウントダウンを開始
     * 3. フリーズ後に落札カウントダウンを開始
     */
    public function handleImmediatePriceIncrement(Lane $lane, Item $item, Auction $auction, ?int $lastBidderUserId = null): void
    {
        $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();

        if ($activeBidderCount < 2) {
            return;
        }

        $this->handlePriceIncrement($lane, $item, $auction, $activeBidderCount, $lastBidderUserId);
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

                broadcast(new BidLimitReached(
                    $auction->id, $lane->id, $item->id,
                    $limit->user_id, $item->current_price, $limit->limit_price,
                    $item->species_name ?? ''
                ));

                // LINE通知（指値発動）
                try {
                    app(NotificationService::class)->sendBidLimitReachedNotification(
                        $limit->user_id, $item->species_name ?? '商品',
                        $limit->limit_price, $item->current_price
                    );
                } catch (\Exception $lineErr) {
                    Log::warning("BidLimit LINE notify error: " . $lineErr->getMessage());
                }

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

            // 事前に指値を設定していたユーザーを自動で入札ONにする
            $autoActivated = 0;
            try {
                $freshNext = $nextItem->fresh();
                Log::info("moveToNextItem: calling activatePendingBidLimits for item {$freshNext->id}, status={$freshNext->status}");
                $autoActivated = $this->setBidLimitAction->activatePendingBidLimits($freshNext);
                Log::info("moveToNextItem: activatePendingBidLimits returned {$autoActivated} for item {$freshNext->id}");
            } catch (\Exception $e) {
                Log::error("Auto-bid activation error: " . $e->getMessage() . "\n" . $e->getTraceAsString());
            }

            // 入札開始待機の残り秒数を取得
            $countdownState = $this->getCountdownState($lane->id);
            $preBidRemaining = ($countdownState && ($countdownState['phase'] ?? '') === 'pre_bid')
                ? $countdownState['remaining_seconds'] : 0;

            // お気に入り順番接近通知（5個前のユーザーにLINE通知）
            try {
                $this->favoriteNotifyAction->execute($lane, $nextItem);
            } catch (\Exception $e) {
                Log::warning("Favorite notify error: " . $e->getMessage());
            }

            // ★ 自動入札で追加された入札者を含めた実際のカウントを取得
            $activeBidderCount = BidParticipant::forItem($nextItem->id)->active()->count();
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
     *
     * ■ 一時停止中に管理画面で設定変更された可能性があるため、
     *   再開時にオークション設定を再読み込みしてキャッシュを更新する
     */
    public function resumeCountdown(int $laneId): void
    {
        $state = Cache::get($this->getCacheKey($laneId));
        if (!$state) return;

        $lane = Lane::with('auction')->find($laneId);
        if ($lane && $lane->auction) {
            $settings      = $lane->auction->getAuctionSettings();
            $newBid        = (float) ($settings['bid_countdown_seconds'] ?? 5);
            $newFreeze     = (float) ($settings['freeze_countdown_seconds'] ?? 1);

            $oldBid = $state['bid_countdown_seconds'] ?? null;

            $state['bid_countdown_seconds']    = $newBid;
            $state['freeze_countdown_seconds'] = $newFreeze;

            if ($oldBid !== $newBid) {
                Log::info("Countdown settings refreshed on resume: lane {$laneId}, bid {$oldBid}→{$newBid}, freeze→{$newFreeze}");
            }
        }

        $state['is_running'] = true;
        Cache::put($this->getCacheKey($laneId), $state, 3600);
        Log::info("Countdown resumed: lane {$laneId}, remaining {$state['remaining_seconds']}s, phase {$state['phase']}");
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
