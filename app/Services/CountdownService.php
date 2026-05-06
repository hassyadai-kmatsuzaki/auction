<?php

namespace App\Services;

use App\Actions\Auction\FinishAuctionAction;
use App\Actions\Bid\FinalizeBidAction;
use App\Actions\Bid\LeaveBidAction;
use App\Actions\Bid\SetBidLimitAction;
use App\Jobs\NotifyFavoriteApproachingJob;
use App\Models\Auction;
use App\Models\BidEvent;
use App\Models\BidLimitPrice;
use App\Models\Item;
use App\Models\Lane;
use App\Models\BidParticipant;
use App\Services\Monitoring\MetricRecorder;
use App\Events\BidderUpdated;
use App\Events\BidLimitReached;
use App\Events\CountdownTick;
use App\Events\LaneItemChanged;
use App\Events\AuctionStatusChanged;
use App\Logging\BroadcastFailureLogger;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CountdownService
{
    /**
     * Tick interval in seconds (0.5 = 500ms)
     */
    public const TICK_INTERVAL = 0.5;

    /**
     * countdown:lane:* キャッシュの TTL（秒）。
     * ジョブの heartbeat TTL（4時間）と一致させ、長時間ポーズでも cache が消えないようにする。
     * 短い TTL（旧: 3600s）だと、長時間ポーズ中に cache 切れ → 再 startCountdown で
     * カウント秒数が start_price 基準にリセットされ、freeze が無視される事故が起きる。
     */
    public const CACHE_TTL = 14400;

    public function __construct(
        private readonly FinalizeBidAction                $finalizeBidAction,
        private readonly LeaveBidAction                   $leaveBidAction,
        private readonly SetBidLimitAction                $setBidLimitAction,
        private readonly MetricRecorder                   $metrics,
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
     * pre_bid / freeze など低頻度フェーズで「整数秒のティックだけ」 broadcast するか判定。
     *
     * tick は 0.5 秒ごとに呼ばれるが、ボタン無効中の表示は 1 秒粒度で十分。
     * remaining が 0 のときも broadcast（フェーズ終了タイミングを必ず通知）。
     */
    protected function shouldBroadcastLowFrequency(float $remainingSeconds): bool
    {
        if ($remainingSeconds <= 0) {
            return true;
        }
        // 0.5 ステップで減算する前提で、整数秒（n.0）のときのみ true
        return abs(fmod($remainingSeconds, 1.0)) < 0.05;
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
        
        $countdownSeconds = $auction->calculateCountdownSeconds($item->current_price);
        $bidSeconds    = $countdownSeconds['bid_countdown_seconds'];
        $freezeSeconds = $countdownSeconds['freeze_countdown_seconds'];

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
            'last_bidder_user_id' => null,
        ];
        
        Cache::put($this->getCacheKey($lane->id), $cacheData, self::CACHE_TTL);

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
        $countdownSeconds = $auction->calculateCountdownSeconds($item->current_price);
        $bidSeconds    = $countdownSeconds['bid_countdown_seconds'];
        $freezeSeconds = $countdownSeconds['freeze_countdown_seconds'];

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
            'last_bidder_user_id' => null,
        ];

        Cache::put($this->getCacheKey($lane->id), $cacheData, self::CACHE_TTL);

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

        // 新しい価格に基づいてカウントダウン秒数を再計算
        $lane->load(['currentItem', 'auction']);
        $item = $lane->currentItem;
        $auction = $lane->auction;

        if ($item && $auction) {
            $countdownSeconds = $auction->calculateCountdownSeconds($item->current_price);
            $state['bid_countdown_seconds']    = $countdownSeconds['bid_countdown_seconds'];
            $state['freeze_countdown_seconds'] = $countdownSeconds['freeze_countdown_seconds'];
        }

        $freezeSeconds = (float) ($state['freeze_countdown_seconds'] ?? 1);

        $state['phase'] = 'freeze';
        $state['remaining_seconds'] = $freezeSeconds;
        $state['started_at'] = now()->timestamp;

        Cache::put($this->getCacheKey($lane->id), $state, self::CACHE_TTL);

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

        Cache::put($this->getCacheKey($lane->id), $state, self::CACHE_TTL);

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

        // オークション設定の同期（金額帯テーブル対応・途中変更対応）
        $latestCountdown = $auction->calculateCountdownSeconds($item->current_price);
        $latestBid       = $latestCountdown['bid_countdown_seconds'];
        $latestFreeze    = $latestCountdown['freeze_countdown_seconds'];

        if (($state['bid_countdown_seconds'] ?? null) != $latestBid) {
            $state['bid_countdown_seconds']    = $latestBid;
            $state['freeze_countdown_seconds'] = $latestFreeze;
        }

        // カウントダウンを0.5秒減らす
        $state['remaining_seconds'] = max(0, $state['remaining_seconds'] - self::TICK_INTERVAL);

        // 1秒粒度に間引いて broadcast（120名負荷対策・実装書 B1）
        // フロント側は秒単位表示なので 0.5秒粒度は冗長。
        // ※ 本ガード追加前は3 lanes × 0.5秒粒度 × 120接続 = 360 msg/秒の負荷だった。
        if ($this->shouldBroadcastLowFrequency($state['remaining_seconds'])) {
            try {
                broadcast(new CountdownTick(
                    $auction->id, $lane->id, $item->id,
                    (float) $state['remaining_seconds'],
                    $activeBidderCount, $item->current_price,
                    'bidding'
                ));
            } catch (\Exception $e) {
                BroadcastFailureLogger::warn('CountdownTick', $e->getMessage(), ['lane_id' => $laneId, 'phase' => 'bidding']);
            }
        }

        $this->metrics->countdownTick($laneId, 'bidding', (float) $state['remaining_seconds']);

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
                    Cache::put($this->getCacheKey($laneId), $state, self::CACHE_TTL);
                    return ['action' => 'recovery', 'lane_id' => $laneId];
                }
            }
        }

        Cache::put($this->getCacheKey($laneId), $state, self::CACHE_TTL);

        return ['action' => 'tick', 'remaining_seconds' => $state['remaining_seconds']];
    }

    /**
     * 入札開始待機フェーズのティック処理（0.5秒ごと）
     *
     * ■ broadcast は 1 秒粒度に間引く:
     *   pre_bid 中は入札ボタンが無効化されているので 0.5 秒粒度の表示精度は不要。
     *   broadcast 半減で Reverb の outbound 帯域を抑える。
     *   フェーズ切替の broadcast は別途行うので終了タイミングは取りこぼさない。
     */
    protected function tickPreBid(int $laneId, Lane $lane, Item $item, Auction $auction, array $state): array
    {
        $state['remaining_seconds'] = max(0, $state['remaining_seconds'] - self::TICK_INTERVAL);
        $state['pre_bid_remaining_seconds'] = $state['remaining_seconds'];

        if ($this->shouldBroadcastLowFrequency($state['remaining_seconds'])) {
            try {
                broadcast(new CountdownTick(
                    $auction->id, $lane->id, $item->id,
                    (float) $state['remaining_seconds'],
                    0, $item->current_price,
                    'pre_bid'
                ));
            } catch (\Exception $e) {
                BroadcastFailureLogger::warn('CountdownTick', $e->getMessage(), ['lane_id' => $laneId, 'phase' => 'pre_bid']);
            }
        }

        $this->metrics->countdownTick($laneId, 'pre_bid', (float) $state['remaining_seconds']);

        if ($state['remaining_seconds'] <= 0) {
            $bidSeconds = (float) ($state['bid_countdown_seconds'] ?? 5);
            $state['phase'] = 'bidding';
            $state['remaining_seconds'] = $bidSeconds;
            $state['pre_bid_remaining_seconds'] = 0;
            $state['started_at'] = now()->timestamp;

            Cache::put($this->getCacheKey($laneId), $state, self::CACHE_TTL);

            // pre_bid→bidding 遷移時に初回カウントダウン値をbroadcast
            try {
                $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();
                broadcast(new CountdownTick(
                    $auction->id, $lane->id, $item->id,
                    (float) $bidSeconds,
                    $activeBidderCount, $item->current_price,
                    'bidding'
                ));
            } catch (\Exception $e) {
                BroadcastFailureLogger::warn('CountdownTick', $e->getMessage(), ['lane_id' => $laneId, 'phase' => 'pre_bid_to_bidding']);
            }

            Log::info("Pre-bid ended, bidding started: lane {$laneId}, item {$item->id}, countdown={$bidSeconds}s");

            return ['action' => 'pre_bid_end', 'lane_id' => $laneId];
        }

        Cache::put($this->getCacheKey($laneId), $state, self::CACHE_TTL);

        return ['action' => 'pre_bid_tick', 'remaining_seconds' => $state['remaining_seconds']];
    }

    /**
     * フリーズ（誤タップ防止）フェーズのティック処理（0.5秒ごと）
     * フリーズ中は入札ボタンが無効化される
     *
     * ■ broadcast は 1 秒粒度に間引く（pre_bid と同じ理由：UX 影響なし、帯域節約）
     */
    protected function tickFreeze(int $laneId, Lane $lane, Item $item, Auction $auction, array $state): array
    {
        $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();
        $freshPrice = $item->fresh()->current_price ?? $item->current_price;

        $state['remaining_seconds'] = max(0, $state['remaining_seconds'] - self::TICK_INTERVAL);

        if ($this->shouldBroadcastLowFrequency($state['remaining_seconds'])) {
            try {
                broadcast(new CountdownTick(
                    $auction->id, $lane->id, $item->id,
                    (float) $state['remaining_seconds'],
                    $activeBidderCount, $freshPrice,
                    'freeze'
                ));
            } catch (\Exception $e) {
                BroadcastFailureLogger::warn('CountdownTick', $e->getMessage(), ['lane_id' => $laneId, 'phase' => 'freeze']);
            }
        }

        $this->metrics->countdownTick($laneId, 'freeze', (float) $state['remaining_seconds']);

        if ($state['remaining_seconds'] <= 0) {
            $bidSeconds = (float) ($state['bid_countdown_seconds'] ?? 5);
            $state['phase'] = 'bidding';
            $state['remaining_seconds'] = $bidSeconds;
            $state['started_at'] = now()->timestamp;

            Cache::put($this->getCacheKey($laneId), $state, self::CACHE_TTL);

            // freeze→bidding 遷移時に初回カウントダウン値をbroadcast
            // これがないとフロントは bidding 初回値を受信できず表示がずれる
            try {
                broadcast(new CountdownTick(
                    $auction->id, $lane->id, $item->id,
                    (float) $bidSeconds,
                    $activeBidderCount, $freshPrice,
                    'bidding'
                ));
            } catch (\Exception $e) {
                BroadcastFailureLogger::warn('CountdownTick', $e->getMessage(), ['lane_id' => $laneId, 'phase' => 'freeze_to_bidding']);
            }

            Log::info("Freeze ended, bid countdown started: lane {$laneId}, item {$item->id}, countdown={$bidSeconds}s");

            return ['action' => 'freeze_end', 'lane_id' => $laneId];
        }

        Cache::put($this->getCacheKey($laneId), $state, self::CACHE_TTL);

        return ['action' => 'freeze_tick', 'remaining_seconds' => $state['remaining_seconds']];
    }

    /**
     * 価格上昇処理（金額帯別上昇幅テーブル対応）
     *
     * 入札者2人以上 → 即座に価格上昇 → フリーズカウントダウン開始
     */
    protected function handlePriceIncrement(
        Lane $lane,
        Item $item,
        Auction $auction,
        int $activeBidderCount,
        ?int $lastBidderUserId = null,
        int $minActiveBidders = 2
    ): void
    {
        if ($item->status !== 'live' || $activeBidderCount < $minActiveBidders) {
            return;
        }

        // 並行呼び出しに備えて呼び出し時点の想定価格を記録
        $expectedOldPrice = (float) $item->current_price;

        DB::beginTransaction();
        try {
            // 🔒 行ロックを取得し、最新状態で再検証する
            //    （他ワーカーが先に上昇させていたら冪等にスキップ）
            $locked = Item::where('id', $item->id)->lockForUpdate()->first();
            if (!$locked || $locked->status !== 'live') {
                DB::rollBack();
                return;
            }

            if ((float) $locked->current_price !== $expectedOldPrice) {
                DB::rollBack();
                Log::info("handlePriceIncrement: price already changed by another handler. item={$locked->id}, expected={$expectedOldPrice}, actual={$locked->current_price} — skipping.");
                return;
            }

            // 行ロック内で active 入札者を一括取得し、count はコレクションから取る
            // （count() / get() を別々に発行していた重複クエリを統合）
            $allActive = BidParticipant::forItem($locked->id)->active()->get();
            $freshActiveCount = $allActive->count();
            if ($freshActiveCount < $minActiveBidders) {
                DB::rollBack();
                Log::info("handlePriceIncrement: active count dropped to {$freshActiveCount} (min={$minActiveBidders}) under lock. item={$locked->id} — skipping.");
                return;
            }

            // 以降は行ロック済みの最新インスタンスを使用
            $item = $locked;
            $activeBidderCount = $freshActiveCount;

            $oldPrice  = $item->current_price;
            $increment = $auction->calculatePriceIncrement($oldPrice);
            $newPrice  = $oldPrice + $increment;

            $item->update(['current_price' => $newPrice]);

            \App\Models\PriceEvent::recordAutoIncrement($item->id, $oldPrice, $newPrice, $activeBidderCount);

            // 価格上昇時の入札者整理:
            // - 有効な指値（limit_price > 新価格）を持つユーザー → 入札継続
            //   └ 指値が最も高いユーザーが落札権利者
            // - 有効な指値ユーザーがいる場合 → 手動入札者は全員離脱
            // - 有効な指値ユーザーがいない場合 → lastBidder が1回分残る（従来動作）
            $autoLeftUserIds = [];

            // 有効な指値を持つユーザーを指値の高い順に取得
            $validLimits = BidLimitPrice::where('item_id', $item->id)
                ->where('is_triggered', false)
                ->where('limit_price', '>', $newPrice)
                ->orderBy('limit_price', 'desc')
                ->orderBy('created_at', 'asc')
                ->get();

            $protectedUserIds = $validLimits->pluck('user_id')->toArray();
            $hasProtectedUsers = count($protectedUserIds) > 0;

            // lastBidder が null の場合、最後に入札した人をフォールバック
            // すでに $allActive を取得済みなので、追加クエリは発行せずコレクションから抽出する
            $resolvedLastBidder = $lastBidderUserId;
            if (!$resolvedLastBidder && !$hasProtectedUsers && $allActive->isNotEmpty()) {
                $latestParticipant = $allActive->sortByDesc('activated_at')->first();
                $resolvedLastBidder = $latestParticipant?->user_id;
            }

            $effectiveHolder = $hasProtectedUsers
                ? $validLimits->first()->user_id
                : $resolvedLastBidder;

            Log::info("handlePriceIncrement: item={$item->id}, oldPrice={$oldPrice}, newPrice={$newPrice}, activeCount=" . $allActive->count() . ", protectedUsers=" . json_encode($protectedUserIds) . ", hasProtected={$hasProtectedUsers}, lastBidder={$lastBidderUserId}, resolvedLastBidder={$resolvedLastBidder}, effectiveHolder={$effectiveHolder}");

            foreach ($allActive as $participant) {
                if (in_array($participant->user_id, $protectedUserIds)) {
                    // 有効な指値ユーザー: 入札継続
                } elseif (!$hasProtectedUsers && $resolvedLastBidder && $participant->user_id === $resolvedLastBidder) {
                    // 指値ユーザーがいない場合のみ、lastBidder を1回分残す
                } else {
                    $participant->deactivate();
                    $autoLeftUserIds[] = $participant->user_id;
                }
            }

            if (count($autoLeftUserIds) > 0) {
                Log::info("Auto-left users on price increment: item={$item->id}, left=" . implode(',', $autoLeftUserIds) . ", holder={$effectiveHolder}");
            }
            if ($hasProtectedUsers) {
                Log::info("Bid-limit holder on price increment: item={$item->id}, holder={$effectiveHolder}, protected=" . implode(',', $protectedUserIds));
            }

            // ─── フリーズ/落札権利者キャッシュを「コミット前」に書き込む ───
            // 理由: items 行ロックが解放されるのは DB::commit() のタイミング。
            //       後続の JoinBidAction などはロック取得後に phase を再判定するため、
            //       commit 前にキャッシュを書いておかないと「freeze 開始の瞬間に
            //       入札を試みた人」が freeze 判定をすり抜けてしまう（数 ms の窓）。
            //       commit 失敗時はキャッシュだけ freeze になるが、tick が freeze を
            //       消化したあと bidding に戻るので最終整合は保たれる。
            $this->startFreezeCountdown($lane);

            $cacheKey = $this->getCacheKey($lane->id);
            $state = Cache::get($cacheKey);
            if ($state) {
                $state['last_bidder_user_id'] = $hasProtectedUsers ? $effectiveHolder : null;
                Cache::put($cacheKey, $state, self::CACHE_TTL);
            }

            DB::commit();

            $this->metrics->priceIncrement($item->id, $lane->id, $oldPrice, $newPrice, 'auto_increment');
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Price increment error: " . $e->getMessage());
            $this->metrics->priceIncrementFailed($item->id, 'handle_price_increment', $e->getMessage());
            return;
        }

        $freshItem = $item->fresh();
        $newActiveBidderCount = BidParticipant::forItem($item->id)->active()->count();

        $newCountdown = $auction->calculateCountdownSeconds($freshItem->current_price);

        try {
            broadcast(new \App\Events\PriceUpdated(
                $auction->id, $lane->id, $item->id,
                $freshItem->current_price, $newActiveBidderCount,
                $newCountdown['bid_countdown_seconds'],
                $autoLeftUserIds
            ));
        } catch (\Exception $e) {
            BroadcastFailureLogger::warn('PriceUpdated', $e->getMessage(), ['item_id' => $item->id, 'lane_id' => $lane->id]);
        }

        // 自動離脱を全クライアントに通知（入札者数の同期）
        if (count($autoLeftUserIds) > 0) {
            try {
                broadcast(new BidderUpdated(
                    $auction->id, $lane->id, $item->id,
                    $newActiveBidderCount, 'left'
                ));
            } catch (\Exception $e) {
                BroadcastFailureLogger::warn('BidderUpdated', $e->getMessage(), ['item_id' => $item->id, 'lane_id' => $lane->id, 'event_type' => 'auto_left']);
            }
        }

        try {
            $this->checkBidLimits($lane, $freshItem, $auction);
        } catch (\Exception $e) {
            Log::error("BidLimit check error after price increment: " . $e->getMessage());
        }

        // 指値ユーザーが2名以上残っている場合、一気に価格調整
        // （1段階ずつの無限ループを防止。フリーズは既に開始済みなので再開始しない）
        $remainingLimits = BidLimitPrice::where('item_id', $item->id)
            ->where('is_triggered', false)
            ->where('limit_price', '>', $freshItem->current_price)
            ->count();

        if ($remainingLimits >= 2) {
            try {
                $this->adjustPriceByBidLimits($freshItem->fresh(), $auction, $lane, false);
            } catch (\Exception $e) {
                Log::error("adjustPriceByBidLimits after price increment: " . $e->getMessage());
            }
        }
    }

    /**
     * 入札者が参加した際の即時価格上昇処理（単方向入札仕様）
     *
     * 発動閾値:
     *   - 指値あり商品（is_triggered=false の BidLimitPrice が1件以上）: 1人目押下で発動
     *     → 押下者が落札権利者として確定。後続の滑り込みは JoinBidAction 側で無視される。
     *   - 指値なし商品: 2人目押下で発動（従来動作）
     *     → 1人だけ参加した場合は開始価格でそのまま落札。
     *
     * 発動内容:
     * 1. 即座に価格を上昇
     * 2. フリーズカウントダウンを開始
     * 3. フリーズ後に落札カウントダウンを開始
     */
    public function handleImmediatePriceIncrement(Lane $lane, Item $item, Auction $auction, ?int $lastBidderUserId = null): void
    {
        $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();

        $hasActiveLimits = BidLimitPrice::where('item_id', $item->id)
            ->where('is_triggered', false)
            ->exists();
        $threshold = $hasActiveLimits ? 1 : 2;

        if ($activeBidderCount < $threshold) {
            return;
        }

        $this->handlePriceIncrement($lane, $item, $auction, $activeBidderCount, $lastBidderUserId, $threshold);
    }

    /**
     * 指値（上限価格）チェック
     * 価格上昇後に呼び出し、上限に達した参加者を自動離脱させる
     *
     * ■ N+1対策: whereIn サブクエリで1回のSQLに集約
     * ■ 競合対策: items.lockForUpdate + bulk update で楽観的ロックなしで安全
     *
     * ■ H1 + H3 修正（実装書 B2 + B7 + B8 + B9 を本パスにも適用）:
     *   旧版は foreach 内で「markAsTriggered → DB::transaction → deactivate →
     *   個別 BidLimitReached broadcast → 同期 LINE/Mail 通知」を 1 件ずつ実行していた。
     *   25 名同時 hit 時:
     *     - DB::transaction × 25 = items 行ロック取得 25 回（直列化で長期化）
     *     - 個別 BidLimitReached × 25 = 120 接続なら 3,000 msg/秒の WS バースト
     *     - 同期 sendBidLimitReachedNotification × 25 = 5〜10 秒間 tick worker 詰まり
     *   新版は adjustPriceByBidLimits と完全に同じ集約パターンで処理する。
     */
    protected function checkBidLimits(Lane $lane, Item $item, Auction $auction, array $protectedUserIds = []): void
    {
        // 価格超過した全指値レコードを取得（アクティブ/非アクティブ問わず）
        $query = BidLimitPrice::where('item_id', $item->id)
            ->where('is_triggered', false)
            ->where('limit_price', '<=', $item->current_price);

        if (!empty($protectedUserIds)) {
            $query->whereNotIn('user_id', $protectedUserIds);
        }

        $limits = $query->get();

        if ($limits->isEmpty()) {
            return;
        }

        $auctionId   = $auction->id;
        $laneId      = $lane->id;
        $itemId      = $item->id;
        $speciesName = $item->species_name ?? '';

        $batchTriggered  = [];
        $newActiveCount  = null;
        $broadcastPrice  = (float) $item->current_price;

        // ─── 単一 transaction + items 行ロックで全件まとめて処理（B7） ──
        //   foreach 内の DB::transaction × N → 1 回の transaction にまとめる。
        //   親（handlePriceIncrement）は既に commit 済みのため、入れ子にならない。
        try {
            DB::transaction(function () use (
                $limits, $itemId, &$batchTriggered, &$newActiveCount, &$broadcastPrice
            ) {
                $locked = Item::where('id', $itemId)->lockForUpdate()->first();
                if (!$locked || $locked->status !== 'live') {
                    return;
                }
                $broadcastPrice = (float) $locked->current_price;

                // bulk update is_triggered=true（lock 保持時間短縮）
                $idsToTrigger = $limits->pluck('id')->toArray();
                if (!empty($idsToTrigger)) {
                    BidLimitPrice::whereIn('id', $idsToTrigger)
                        ->where('is_triggered', false)
                        ->update([
                            'is_triggered' => true,
                            'triggered_at' => now(),
                            'updated_at'   => now(),
                        ]);
                }

                // ロック取得後の最新 active 入札者を一括取得
                $activeBidderUserIds = BidParticipant::where('item_id', $locked->id)
                    ->where('is_active', true)
                    ->pluck('user_id')
                    ->toArray();

                foreach ($limits as $limit) {
                    try {
                        $userId         = $limit->user_id;
                        $limitPrice     = (float) $limit->limit_price;
                        $isActiveBidder = in_array($userId, $activeBidderUserIds);

                        if ($isActiveBidder) {
                            $p = BidParticipant::forItem($locked->id)
                                ->forUser($userId)->first();
                            if ($p && $p->is_active) {
                                $p->deactivate();
                                BidEvent::recordLeave(
                                    $locked->id, $userId, $broadcastPrice
                                );
                            }
                        }

                        $limit->delete();

                        $batchTriggered[] = [
                            'user_id'         => $userId,
                            'limit_price'     => $limitPrice,
                            'action'          => $isActiveBidder ? 'cancelled' : 'triggered',
                            'protected'       => false,
                            // 通知 chunk 用（broadcast 前に剥がす）
                            '_notify_user_id' => $userId,
                            '_notify_limit'   => $limitPrice,
                        ];
                    } catch (\Exception $e) {
                        Log::error("checkBidLimits row error: item={$locked->id}, user={$limit->user_id} - " . $e->getMessage());
                    }
                }

                $newActiveCount = BidParticipant::forItem($locked->id)
                    ->active()->count();
            }, 3);
        } catch (\Throwable $txErr) {
            Log::error("checkBidLimits transaction error: item={$itemId} - " . $txErr->getMessage());
            return;
        }

        if (empty($batchTriggered)) {
            return;
        }

        // ─── B2 + B8: 件数別 broadcast 戦略 ─────────────────────────
        //   - 件数 < 5: 個別 BidLimitReached を発火（旧フロント互換、軽量）
        //   - 件数 >= 5: 個別を skip し batch 1 個に集約
        //   25 名同時 hit 時: 25 broadcast → 1 broadcast（96% 削減）
        $cancelledItems = array_values(array_filter(
            $batchTriggered,
            fn($t) => !$t['protected'] && $t['action'] === 'cancelled'
        ));
        $cancelCount = count($cancelledItems);

        $publicBatch = array_values(array_map(function ($t) {
            unset($t['_notify_user_id'], $t['_notify_limit']);
            return $t;
        }, $batchTriggered));

        if ($cancelCount > 0 && $cancelCount < 5) {
            foreach ($cancelledItems as $bt) {
                try {
                    broadcast(new BidLimitReached(
                        $auctionId, $laneId, $itemId,
                        $bt['user_id'], $broadcastPrice, $bt['limit_price'],
                        $speciesName
                    ));
                } catch (\Exception $brErr) {
                    Log::warning("BidLimitReached broadcast error: " . $brErr->getMessage());
                }
            }
        }

        try {
            broadcast(new \App\Events\BidLimitsBatchTriggered(
                $auctionId, $laneId, $itemId,
                $broadcastPrice,
                $publicBatch
            ));
        } catch (\Exception $batchErr) {
            Log::warning("BidLimitsBatchTriggered broadcast error: " . $batchErr->getMessage());
        }

        // active count 同期（25 個の BidderUpdated → 1 個に集約）
        if ($newActiveCount !== null && $cancelCount > 0) {
            try {
                broadcast(new BidderUpdated(
                    $auctionId, $laneId, $itemId,
                    $newActiveCount, 'left'
                ))->toOthers();
            } catch (\Exception $brErr) {
                BroadcastFailureLogger::warn('BidderUpdated', $brErr->getMessage(), [
                    'item_id' => $itemId, 'lane_id' => $laneId,
                    'event_type' => 'bid_limit_left',
                ]);
            }
        }

        // ─── B9 + C2: LINE/Mail 通知を chunk 単位で queue 送信 ─────────
        //   25 名同時 hit でも tick worker は同期 send で詰まらない。
        $notifyTargets = array_values(array_filter(
            $batchTriggered,
            fn($t) => isset($t['_notify_user_id']) && !$t['protected']
        ));
        if (!empty($notifyTargets)) {
            $notifySpeciesName = $item->species_name ?? '商品';
            foreach (array_chunk($notifyTargets, 20) as $chunk) {
                try {
                    \App\Jobs\NotifyBidLimitChunkJob::dispatch(
                        $itemId, $notifySpeciesName, $broadcastPrice, $chunk
                    );
                } catch (\Throwable $jobErr) {
                    Log::warning("checkBidLimits notify dispatch failed, falling back to sync: " . $jobErr->getMessage());
                    foreach ($chunk as $t) {
                        try {
                            app(NotificationService::class)->sendBidLimitReachedNotification(
                                $t['_notify_user_id'], $notifySpeciesName,
                                $t['_notify_limit'], $broadcastPrice
                            );
                        } catch (\Throwable $lineErr) {
                            Log::warning("BidLimit notify fallback failed: " . $lineErr->getMessage());
                        }
                    }
                }
            }
        }

        Log::info("checkBidLimits batched: item={$itemId}, total=" . count($batchTriggered) . ", cancelled={$cancelCount}");
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
        //
        // ■ H2 修正: FinalizeBidAction の戻り値を必ず検査する
        //   $activeBidderCount は tick() L278 で items lock 外で読まれているため、
        //   FinalizeBidAction が internal で再 read した時点で「実は 2+ active」だった
        //   ケースが起こりうる。その場合 FinalizeBidAction は failure DTO を返すが、
        //   旧版は戻り値を捨てていたため item.status が live のまま moveToNextItem が走り、
        //   レーンだけ次商品に進む「ゴーストアイテム」化を招いていた。
        //   失敗時は throw → 上位 tick() の catch で 'bidding' phase に reset され、
        //   次サイクルで正しい active count を見て price increment 経路に入る。
        DB::beginTransaction();
        try {
            if ($activeBidderCount === 0) {
                $item->update(['status' => 'unsold']);
                Log::info("Item {$item->id} unsold");
            } elseif ($activeBidderCount === 1) {
                $finalizeResult = $this->finalizeBidAction->execute($item);
                if (!$finalizeResult->success) {
                    DB::rollBack();
                    Log::warning("handleCountdownEnd: finalize failed for item {$item->id}, treating as race - " . ($finalizeResult->message ?? ''));
                    throw new \RuntimeException('finalize_race_detected: ' . ($finalizeResult->message ?? ''));
                }
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

                // 指値2名以上 → 2番目に低い指値の次の上昇金額まで価格を自動調整
                // startFreeze=false: pre_bidフェーズを維持する（商品切替直後なので）
                if ($autoActivated >= 2) {
                    $this->adjustPriceByBidLimits($freshNext, $auction, $lane, false);
                }
            } catch (\Exception $e) {
                Log::error("Auto-bid activation error: " . $e->getMessage() . "\n" . $e->getTraceAsString());
            }

            // 入札開始待機の残り秒数を取得
            $countdownState = $this->getCountdownState($lane->id);
            $preBidRemaining = ($countdownState && ($countdownState['phase'] ?? '') === 'pre_bid')
                ? $countdownState['remaining_seconds'] : 0;

            // お気に入り順番接近通知（notify queue で非同期実行 — countdown worker をブロックしない）
            try {
                NotifyFavoriteApproachingJob::dispatch($lane, $nextItem);
            } catch (\Exception $e) {
                Log::warning("Favorite notify dispatch error: " . $e->getMessage());
            }

            // ★ 自動入札・指値調整後の最新状態を取得
            $nextItem->refresh();
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
        try {
            broadcast(new LaneItemChanged(
                $auction->id,
                $lane->id,
                $lane->lane_number,
                $previousItemId,
                $currentItemData
            ));
        } catch (\Exception $e) {
            BroadcastFailureLogger::warn('LaneItemChanged', $e->getMessage(), ['lane_id' => $lane->id]);
        }

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
            Cache::put($this->getCacheKey($laneId), $state, self::CACHE_TTL);
            Log::info("Countdown paused: lane {$laneId}, remaining {$state['remaining_seconds']}s");
        }
    }

    /**
     * カウントダウンを再開（一時停止から復帰）
     *
     * ■ 一時停止中に管理画面で設定変更された可能性があるため、
     *   再開時にオークション設定を再読み込みしてキャッシュを更新する
     * ■ 一時停止前に phase='freeze' だった場合、再開後に freeze が残ったままだと
     *   入札ボタンが永続的に無効になるため、bidding にリセットする
     *   （負荷レビュー H5 指摘）。
     */
    public function resumeCountdown(int $laneId): void
    {
        $state = Cache::get($this->getCacheKey($laneId));
        if (!$state) return;

        $lane = Lane::with('auction')->find($laneId);
        $newBid = null;
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

        // 一時停止中に消化された扱いにして freeze を bidding に戻す。
        // pre_bid は短時間（数秒）かつ商品切替直後なのでそのまま継続させる。
        if (($state['phase'] ?? null) === 'freeze') {
            $previousRemaining = $state['remaining_seconds'] ?? null;
            $state['phase']             = 'bidding';
            $state['remaining_seconds'] = (float) ($newBid ?? $state['bid_countdown_seconds'] ?? 5);
            Log::warning("Countdown phase reset on resume: lane {$laneId}, freeze({$previousRemaining}s) → bidding({$state['remaining_seconds']}s)");
        }

        $state['is_running'] = true;
        Cache::put($this->getCacheKey($laneId), $state, self::CACHE_TTL);
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

            // 送料を自動計算（管理者承認前）
            try {
                app(\App\Actions\Auction\FinishAuctionAction::class)
                    ->calculateShippingForAuction($auction);
            } catch (\Exception $e) {
                Log::warning('自動終了時の送料計算に失敗', [
                    'auction_id' => $auction->id,
                    'error' => $e->getMessage(),
                ]);
            }

            // ステータス変更イベントをブロードキャスト
            try {
                broadcast(new AuctionStatusChanged(
                    $auction->id,
                    'finished',
                    'すべての出品が終了しました。オークションが自動終了しました。'
                ));
            } catch (\Exception $e) {
                BroadcastFailureLogger::warn('AuctionStatusChanged', $e->getMessage(), ['auction_id' => $auction->id]);
            }
        }
    }

    /**
     * 指値ベースの価格自動調整
     *
     * 指値が2名以上入っている場合、2番目に低い指値を超える次の上昇金額まで
     * 価格を一気に上げ、下位の指値ユーザーを自動離脱させる。
     *
     * 例: 開始100円、Aさん指値1,000円、Bさん指値2,000円
     *   → 1,000円を超える次の上昇金額（例: 1,100円）まで価格上昇
     *   → Aさんは指値発動で離脱、Bさんが1,100円で落札権利保持
     *
     * @param bool $startFreeze true=ライブ中の指値設定時（フリーズ開始）
     *                          false=商品切替時（pre_bidフェーズを維持）
     */
    public function adjustPriceByBidLimits(Item $item, Auction $auction, Lane $lane, bool $startFreeze = true): void
    {
        $expectedOldPrice = (float) $item->current_price;

        // 🔒 行ロックを取得して最新状態で開始する
        //    （他ワーカーが先に価格を上昇させていたら、現在価格を基準に再計算する）
        DB::beginTransaction();
        $locked = Item::where('id', $item->id)->lockForUpdate()->first();
        if (!$locked || $locked->status !== 'live') {
            DB::rollBack();
            return;
        }

        // 他ハンドラによる変更があれば最新値を使う（スキップではなく継続）
        if ((float) $locked->current_price !== $expectedOldPrice) {
            Log::info("adjustPriceByBidLimits: price changed by another handler. expected={$expectedOldPrice}, actual={$locked->current_price} — recalculating with latest.");
        }
        $item = $locked;
        $currentPrice = $item->current_price;

        $limits = BidLimitPrice::where('item_id', $item->id)
            ->where('is_triggered', false)
            ->where('limit_price', '>', $currentPrice)
            ->orderBy('limit_price', 'asc')
            ->orderBy('created_at', 'asc')
            ->get();

        if ($limits->count() < 2) {
            DB::rollBack();
            return;
        }

        $lowestLimit = $limits[0]->limit_price;
        $secondLowestLimit = $limits[1]->limit_price;

        $targetPrice = $currentPrice;
        $protectedUserIds = [];

        // 同額指値の場合: 先に設定した方を保護し、その金額でスタート
        if ($lowestLimit == $secondLowestLimit) {
            $targetPrice = $lowestLimit;

            // 同額の指値を持つユーザーのうち、最も早く設定した人を保護
            $earliestUser = BidLimitPrice::where('item_id', $item->id)
                ->where('is_triggered', false)
                ->where('limit_price', $lowestLimit)
                ->orderBy('created_at', 'asc')
                ->first();

            if ($earliestUser) {
                $protectedUserIds[] = $earliestUser->user_id;
                Log::info("adjustPriceByBidLimits: same-price limits detected, protecting earliest user={$earliestUser->user_id}, price={$lowestLimit}");
            }

            // 同額より高い指値を持つユーザーも保護
            foreach ($limits as $l) {
                if ($l->limit_price > $targetPrice && !in_array($l->user_id, $protectedUserIds)) {
                    $protectedUserIds[] = $l->user_id;
                }
            }
        } else {
            // 通常ケース: 最低指値を超える次の上昇金額まで価格を上げる
            $safetyCounter = 0;
            while ($targetPrice <= $lowestLimit) {
                $increment = $auction->calculatePriceIncrement($targetPrice);
                if ($increment <= 0) {
                    Log::error("adjustPriceByBidLimits: increment is 0 at price={$targetPrice}, breaking to avoid infinite loop");
                    $targetPrice = $lowestLimit + 1;
                    break;
                }
                $targetPrice += $increment;
                if (++$safetyCounter > 10000) {
                    Log::error("adjustPriceByBidLimits: safety counter exceeded at price={$targetPrice}");
                    break;
                }
            }

            // 2番目の指値も超えてしまう場合は調整
            if ($targetPrice > $secondLowestLimit) {
                $targetPrice = $currentPrice;
                $safetyCounter = 0;
                while (true) {
                    $increment = $auction->calculatePriceIncrement($targetPrice);
                    if ($increment <= 0) {
                        Log::error("adjustPriceByBidLimits: increment is 0 in second loop at price={$targetPrice}");
                        break;
                    }
                    $nextPrice = $targetPrice + $increment;
                    if ($nextPrice > $secondLowestLimit) {
                        break;
                    }
                    $targetPrice = $nextPrice;
                    if (++$safetyCounter > 10000) {
                        Log::error("adjustPriceByBidLimits: safety counter exceeded in second loop at price={$targetPrice}");
                        break;
                    }
                }
                // 上昇幅の刻みでは最低指値を超えられない場合、
                // 2番目の指値者の金額をそのまま価格に設定して落札権利を与える
                if ($targetPrice <= $lowestLimit) {
                    $targetPrice = $secondLowestLimit;
                }
            }

            // 2番目以降の指値者で、指値がまだ有効な人を保護
            for ($i = 1; $i < $limits->count(); $i++) {
                if ($limits[$i]->limit_price > $targetPrice) {
                    $protectedUserIds[] = $limits[$i]->user_id;
                } elseif ($limits[$i]->limit_price == $targetPrice) {
                    $samePriceEarliest = BidLimitPrice::where('item_id', $item->id)
                        ->where('is_triggered', false)
                        ->where('limit_price', $targetPrice)
                        ->orderBy('created_at', 'asc')
                        ->first();
                    if ($samePriceEarliest && $samePriceEarliest->user_id === $limits[$i]->user_id) {
                        $protectedUserIds[] = $limits[$i]->user_id;
                    }
                }
            }
        }

        if ($targetPrice <= $currentPrice) {
            DB::rollBack();
            return;
        }

        Log::info("adjustPriceByBidLimits: item={$item->id}, from={$currentPrice}, to={$targetPrice}, lowest_limit={$lowestLimit}, second_limit={$secondLowestLimit}, protected=" . json_encode($protectedUserIds) . ", startFreeze={$startFreeze}");

        try {
            $item->update(['current_price' => $targetPrice]);
            \App\Models\PriceEvent::recordAutoIncrement($item->id, $currentPrice, $targetPrice, $limits->count());
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error("adjustPriceByBidLimits: price update failed — " . $e->getMessage());
            throw $e;
        }

        $freshItem = $item->fresh();

        // 指値発動チェック: 価格超過した全指値レコードを処理
        // アクティブ入札者 → 離脱 + 削除 + 通知
        // 非アクティブ入札者 → 削除のみ（再入札をブロックしないため）
        //
        // 実装書 B2 + B7: bulk SQL 化 + batch broadcast 集約
        //   - markAsTriggered() の N 回 UPDATE → 1 回の whereIn UPDATE に集約
        //   - BidLimitReached の N 回 broadcast → batch broadcast 1 回 + 既存個別 broadcast を維持
        //   - items.lockForUpdate 保持下なので楽観的ロックは不要（並行更新は来ない）
        $autoLeftUserIds = [];
        $batchTriggered  = []; // BidLimitsBatchTriggered 用集約データ
        try {
            $allTriggeredLimits = BidLimitPrice::where('item_id', $item->id)
                ->where('is_triggered', false)
                ->where('limit_price', '<=', $freshItem->current_price)
                ->get();

            // アクティブな入札者のIDを一括取得
            $activeBidderUserIds = BidParticipant::where('item_id', $item->id)
                ->where('is_active', true)
                ->pluck('user_id')
                ->toArray();

            // ─── B7: bulk update でロック保持時間を短縮 ──────────
            //   修正前: foreach 内で markAsTriggered → 1 件ずつ UPDATE (N 回)
            //   修正後: whereIn で全件を 1 SQL で UPDATE
            //   item 636 で発生した「lock wait timeout 50秒」級の lock 保持を防ぐ
            $idsToTrigger = $allTriggeredLimits->pluck('id')->toArray();
            if (!empty($idsToTrigger)) {
                BidLimitPrice::whereIn('id', $idsToTrigger)->update([
                    'is_triggered' => true,
                    'triggered_at' => now(),
                    'updated_at'   => now(),
                ]);
            }

            foreach ($allTriggeredLimits as $tl) {
                try {
                    $tlLimitPrice = $tl->limit_price;
                    $tlUserId = $tl->user_id;
                    $isProtected = in_array($tlUserId, $protectedUserIds);
                    $isActiveBidder = in_array($tlUserId, $activeBidderUserIds);

                    if ($isProtected) {
                        $tl->delete();
                        Log::info("adjustPriceByBidLimits: limit triggered & cancelled, user PROTECTED (stays active): user={$tlUserId}, price={$freshItem->current_price}, limit={$tlLimitPrice}");
                        // batch にも記録（フロント側で表示制御のため）
                        $batchTriggered[] = [
                            'user_id'     => $tlUserId,
                            'limit_price' => (float) $tlLimitPrice,
                            'action'      => 'triggered',
                            'protected'   => true,
                        ];
                        continue;
                    }

                    if ($isActiveBidder) {
                        // ─── R1 fix: bid_inflight Cache::lock 入れ子取得回避 ──────
                        //   親（JoinBidAction.execute）が "bid_inflight:item:{id}" を
                        //   保持している間にここから LeaveBidAction を呼ぶと、
                        //   LeaveBidAction が同名キーを別 owner token で
                        //   ->get()（ノンブロッキング）→ false → silent fail し、
                        //   BidLimitPrice は削除されるのに BidParticipant が active のまま残る。
                        //   既に items.lockForUpdate 配下なので Cache::lock を経由せず
                        //   handlePriceIncrement(L559) と同じく直接 deactivate する。
                        $tlParticipant = BidParticipant::forItem($freshItem->id)
                            ->forUser($tlUserId)->first();
                        if ($tlParticipant && $tlParticipant->is_active) {
                            $tlParticipant->deactivate();
                            BidEvent::recordLeave(
                                $freshItem->id,
                                $tlUserId,
                                (float) $freshItem->current_price
                            );
                        }
                        $autoLeftUserIds[] = $tlUserId;
                    }

                    $tl->delete();

                    // 新フロント用 batch データを蓄積（個別 broadcast は最後に件数判断）
                    $batchTriggered[] = [
                        'user_id'      => $tlUserId,
                        'limit_price'  => (float) $tlLimitPrice,
                        'action'       => $isActiveBidder ? 'cancelled' : 'triggered',
                        'protected'    => false,
                        // notify_user_ids 用に保持（後段で chunk dispatch する）
                        '_notify_user_id' => $tlUserId,
                        '_notify_limit'   => $tlLimitPrice,
                    ];
                    // ※ LINE/Mail 通知は同期 INSERT/外部 API call が重いため、
                    //   loop 末で afterCommit + queue dispatch でチャンク化（B9）

                    Log::info("adjustPriceByBidLimits: limit triggered & cancelled user={$tlUserId}, active={$isActiveBidder}, price={$freshItem->current_price}, limit={$tlLimitPrice}");
                } catch (\Exception $e) {
                    Log::error("adjustPriceByBidLimits checkBidLimit error: user={$tl->user_id} - " . $e->getMessage());
                }
            }

            // ─── C1 + B2 + B8 + B9: 全 broadcast / 通知 dispatch を afterCommit へ集約 ─────
            //   旧版は items.lockForUpdate 保持中（commit 前）に broadcast を発火していたため、
            //   commit が deadlock / lock_wait_timeout で失敗するとフロントには「指値発動」が
            //   届いた後で DB がロールバックされる整合崩壊を起こしていた。
            //   FinalizeBidAction が DB::afterCommit() を使うのと同じ理由で、外部に出る
            //   「BidLimitReached / BidLimitsBatchTriggered / 通知 Job」は commit 確定後に流す。
            $cancelledItems = array_values(array_filter(
                $batchTriggered,
                fn($t) => !$t['protected'] && $t['action'] === 'cancelled'
            ));
            $cancelCount = count($cancelledItems);

            $publicBatch = array_values(array_map(function ($t) {
                unset($t['_notify_user_id'], $t['_notify_limit']);
                return $t;
            }, $batchTriggered));

            $notifyTargets = array_values(array_filter(
                $batchTriggered,
                fn($t) => isset($t['_notify_user_id']) && !$t['protected']
            ));

            $auctionId           = $auction->id;
            $laneId              = $lane->id;
            $itemId              = $item->id;
            $broadcastPrice      = (float) $freshItem->current_price;
            $broadcastSpecies    = $freshItem->species_name ?? '';
            $notifySpeciesName   = $freshItem->species_name ?? '商品';

            DB::afterCommit(function () use (
                $cancelCount, $cancelledItems, $publicBatch,
                $auctionId, $laneId, $itemId, $broadcastPrice, $broadcastSpecies,
                $notifyTargets, $notifySpeciesName
            ) {
                // 件数 < 5: 旧フロント互換のため個別 BidLimitReached も発火
                // 件数 >= 5: batch 1 発のみ（120 名負荷時に 100 broadcast → 1 broadcast）
                if ($cancelCount > 0 && $cancelCount < 5) {
                    foreach ($cancelledItems as $bt) {
                        try {
                            broadcast(new BidLimitReached(
                                $auctionId, $laneId, $itemId,
                                $bt['user_id'], $broadcastPrice, $bt['limit_price'],
                                $broadcastSpecies
                            ));
                        } catch (\Exception $brErr) {
                            Log::warning("BidLimitReached broadcast error: " . $brErr->getMessage());
                        }
                    }
                }

                if (!empty($publicBatch)) {
                    try {
                        broadcast(new \App\Events\BidLimitsBatchTriggered(
                            $auctionId, $laneId, $itemId,
                            $broadcastPrice,
                            $publicBatch
                        ));
                    } catch (\Exception $batchErr) {
                        Log::warning("BidLimitsBatchTriggered broadcast error: " . $batchErr->getMessage());
                    }
                }

                // ─── B9 + C2: 通知 dispatch（PendingDispatch ラップを排除して正しい API に）
                if (!empty($notifyTargets)) {
                    foreach (array_chunk($notifyTargets, 20) as $chunk) {
                        try {
                            \App\Jobs\NotifyBidLimitChunkJob::dispatch(
                                $itemId, $notifySpeciesName, $broadcastPrice, $chunk
                            );
                        } catch (\Throwable $jobErr) {
                            // dispatch 失敗時のみ同期 fallback（commit 後なので items lock 影響なし）
                            Log::warning("NotifyBidLimitChunkJob dispatch failed, falling back to sync: " . $jobErr->getMessage());
                            foreach ($chunk as $t) {
                                try {
                                    app(NotificationService::class)->sendBidLimitReachedNotification(
                                        $t['_notify_user_id'], $notifySpeciesName,
                                        $t['_notify_limit'], $broadcastPrice
                                    );
                                } catch (\Throwable $lineErr) {
                                    Log::warning("BidLimit notify fallback failed: " . $lineErr->getMessage());
                                }
                            }
                        }
                    }
                }
            });
        } catch (\Exception $e) {
            Log::error("adjustPriceByBidLimits checkBidLimits error: " . $e->getMessage());
        }

        // ─── フリーズ/落札権利者キャッシュを「コミット前」に書き込む ───
        // handlePriceIncrement と同じ理由：items 行ロック解放前に freeze を
        // 反映しておかないと、後続 join がフリーズ中なのに通り抜けてしまう。
        $effectiveHolder = null;

        $highestLimitUser = BidLimitPrice::where('item_id', $item->id)
            ->where('is_triggered', false)
            ->where('limit_price', '>', $freshItem->current_price)
            ->orderBy('limit_price', 'desc')
            ->orderBy('created_at', 'asc')
            ->first();

        if ($highestLimitUser) {
            $effectiveHolder = $highestLimitUser->user_id;
        } elseif (!empty($protectedUserIds)) {
            $effectiveHolder = $protectedUserIds[0];
        }

        if ($startFreeze) {
            $this->startFreezeCountdown($lane);
        }

        if ($effectiveHolder) {
            $cacheKey = $this->getCacheKey($lane->id);
            $state = Cache::get($cacheKey);
            if ($state) {
                $state['last_bidder_user_id'] = $effectiveHolder;
                Cache::put($cacheKey, $state, self::CACHE_TTL);
                Log::info("adjustPriceByBidLimits: set last_bidder_user_id={$effectiveHolder}");
            }
        }

        // 🔓 価格変更とそれに伴う指値トリガー処理までを1トランザクションで確定
        try {
            DB::commit();
            $this->metrics->priceIncrement($item->id, $lane->id, (float) $currentPrice, (float) $targetPrice, 'bid_limit_adjust');
        } catch (\Throwable $e) {
            Log::error("adjustPriceByBidLimits commit failed: " . $e->getMessage());
            $this->metrics->priceIncrementFailed($item->id, 'adjust_price_by_bid_limits', $e->getMessage());
            throw $e;
        }

        $newActiveBidderCount = BidParticipant::forItem($item->id)->active()->count();
        $newCountdown = $auction->calculateCountdownSeconds($freshItem->current_price);

        try {
            broadcast(new \App\Events\PriceUpdated(
                $auction->id, $lane->id, $item->id,
                $freshItem->current_price, $newActiveBidderCount,
                $newCountdown['bid_countdown_seconds'],
                $autoLeftUserIds
            ));
        } catch (\Exception $e) {
            BroadcastFailureLogger::warn('PriceUpdated', $e->getMessage(), ['item_id' => $item->id, 'lane_id' => $lane->id, 'source' => 'adjust_by_bid_limits']);
        }

        if (count($autoLeftUserIds) > 0) {
            try {
                broadcast(new BidderUpdated(
                    $auction->id, $lane->id, $item->id,
                    $newActiveBidderCount, 'left'
                ));
            } catch (\Exception $e) {
                BroadcastFailureLogger::warn('BidderUpdated', $e->getMessage(), ['item_id' => $item->id, 'lane_id' => $lane->id, 'event_type' => 'auto_left_bid_limit']);
            }
        }
    }
}
