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
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

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

        // ─── items 先行ロックでデッドロック・FK lock wait timeout を回避 ──
        // 修正前: BidLimitPrice::updateOrCreate を直接実行 → MySQL が FK 整合性確認のため
        //         items.id の SHARED LOCK を暗黙取得 → adjustPriceByBidLimits の
        //         EXCLUSIVE LOCK と衝突 → innodb_lock_wait_timeout (50秒) で死亡
        // 修正後: items.lockForUpdate() を先に取得して順序付け（実装書 B5）。
        //         過去事故メモ「入札系は items 先行ロック必須」のルールに準拠。
        $limit = DB::transaction(function () use ($item, $userId, $limitPrice) {
            $locked = Item::where('id', $item->id)->lockForUpdate()->first();
            if (!$locked) {
                throw new \RuntimeException('item not found');
            }
            return BidLimitPrice::updateOrCreate(
                ['item_id' => $locked->id, 'user_id' => $userId],
                ['limit_price' => $limitPrice, 'is_triggered' => false, 'triggered_at' => null]
            );
        }, 3);

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
                // ─── items 先行ロックでデッドロック回避 ────────────
                // JoinBidAction と同じロック順序プロトコルを守る
                $participant = BidParticipant::forItem($item->id)->forUser($userId)->first();
                if (!$participant || !$participant->is_active) {
                    $autoBidded = DB::transaction(function () use ($item, $userId) {
                        $locked = Item::where('id', $item->id)->lockForUpdate()->first();
                        if (!$locked || $locked->status !== 'live') {
                            return false;
                        }
                        // 価格再評価（ロック内）: ロック取得待ちの間に他者の入札で価格が上限超えた場合
                        $freshLimit = BidLimitPrice::forItem($locked->id)->forUser($userId)->first();
                        if ($freshLimit && $locked->current_price >= $freshLimit->limit_price) {
                            return false;
                        }
                        $existing = BidParticipant::forItem($locked->id)->forUser($userId)->first();
                        if ($existing && $existing->is_active) {
                            return false;
                        }
                        BidParticipant::participate($locked->id, $userId, true, null, 'auto-bid-from-limit');
                        \App\Models\BidEvent::recordJoin($locked->id, $userId, (float) $locked->current_price, null, 'auto-bid-from-limit');
                        return true;
                    }, 3);

                    if ($autoBidded) {
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
     * ■ 設計:
     *   - JoinBidAction は pre_bid フェーズ中の入札を拒否するため、
     *     ここでは直接 BidParticipant::participate() を使って入札ONにする
     *     （システムによる自動入札なので pre_bid チェックをバイパスする）
     *   - ロック順序プロトコル準拠: items 行ロック → BidParticipant → BidEvent の順で確定。
     *     handlePriceIncrement / adjustPriceByBidLimits と同じ順序なので
     *     今後ライブ中の自動入札パスが追加されても直列化される。
     *   - broadcast は DB::afterCommit で確定後に1回だけ流す
     *     （負荷レビュー H2 指摘: foreach 内 afterCommit 多重発火による
     *      `BidderUpdated` の N 連発と active_bidders_count 過大表示を解消）。
     *   - 旧版は「ユーザー単位 transaction を foreach で繰り返す + 各々 afterCommit」だったが、
     *     items 行ロックを毎回取り直す上に broadcast が ユーザー数だけ重複していた。
     *     現版は「外側 1 transaction + items 行ロック1回 + foreach は participate のみ + afterCommit 1回」。
     */
    public function activatePendingBidLimits(Item $item): int
    {
        $item->loadMissing('auction');

        \Illuminate\Support\Facades\Log::info("activatePendingBidLimits called: item={$item->id}, status={$item->status}, price={$item->current_price}");

        if ($item->status !== 'live') {
            \Illuminate\Support\Facades\Log::info("activatePendingBidLimits: item {$item->id} is not live (status={$item->status}), skipping");
            return 0;
        }

        $auctionId = $item->auction?->id;
        $lane = Lane::where('current_item_id', $item->id)->first();
        $laneId = $lane?->id;
        $itemId = $item->id;

        $activatedUserIds = [];

        try {
            DB::transaction(function () use ($itemId, $auctionId, $laneId, &$activatedUserIds) {
                // 🔒 items 行ロックを 1 回だけ取得（旧版の foreach 内 lockForUpdate を排除）
                $locked = Item::where('id', $itemId)->lockForUpdate()->first();
                if (!$locked || $locked->status !== 'live') {
                    return;
                }

                // ロック取得後の最新状態で対象指値を再取得
                $limits = BidLimitPrice::forItem($locked->id)
                    ->notTriggered()
                    ->where('limit_price', '>', $locked->current_price)
                    ->get();

                if ($limits->isEmpty()) {
                    return;
                }

                // 既に active な参加者を一括取得（foreach 内の N+1 を排除）
                $alreadyActiveUserIds = BidParticipant::forItem($locked->id)
                    ->active()
                    ->whereIn('user_id', $limits->pluck('user_id'))
                    ->pluck('user_id')
                    ->all();
                $alreadyActiveSet = array_flip($alreadyActiveUserIds);

                $currentPrice = (float) $locked->current_price;
                foreach ($limits as $limit) {
                    if (isset($alreadyActiveSet[$limit->user_id])) {
                        continue;
                    }

                    BidParticipant::participate(
                        $locked->id,
                        $limit->user_id,
                        true,
                        null,
                        'auto-bid-from-limit'
                    );

                    \App\Models\BidEvent::recordJoin(
                        $locked->id, $limit->user_id, $currentPrice, null, 'auto-bid-from-limit'
                    );

                    $activatedUserIds[] = $limit->user_id;
                }

                // commit 確定後にだけ broadcast を1回流す（多重発火防止）
                if (!empty($activatedUserIds) && $laneId && $auctionId) {
                    DB::afterCommit(function () use ($auctionId, $laneId, $itemId, $activatedUserIds) {
                        try {
                            $activeCount = BidParticipant::forItem($itemId)->active()->count();
                            broadcast(new BidderUpdated(
                                $auctionId, $laneId, $itemId, $activeCount, 'joined'
                            ));
                        } catch (\Exception $broadcastErr) {
                            \Illuminate\Support\Facades\Log::warning("Auto-bid broadcast error: " . $broadcastErr->getMessage(), [
                                'item_id' => $itemId, 'activated_user_count' => count($activatedUserIds),
                            ]);
                        }
                    });
                }
            }, 3);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning("Auto-bid activation transaction failed: item={$itemId} - " . $e->getMessage());
            return 0;
        }

        $activated = count($activatedUserIds);
        if ($activated > 0) {
            \Illuminate\Support\Facades\Log::info("Auto-bid activated: item={$itemId}, count={$activated}, users=" . implode(',', $activatedUserIds));
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
        // 指値設定時に自動付与したお気に入りも併せて解除する
        Favorite::where('user_id', $userId)->where('item_id', $item->id)->delete();

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
