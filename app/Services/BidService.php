<?php

namespace App\Services;

use App\Models\Auction;
use App\Models\BidLimitPrice;
use App\Models\BidParticipant;
use App\Models\Favorite;
use App\Traits\MediaUrlTrait;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * BidService（スリム版）
 *
 * 入札参加・離脱・落札確定・価格上昇はそれぞれ専用 Action に移行済み。
 * このクラスは「読み取り系」のみを担当する。
 */
class BidService
{
    use MediaUrlTrait;

    /**
     * @deprecated CountdownService との循環参照回避のために残存。使用不要。
     */
    public function setCountdownService(mixed $countdownService): void {}

    /**
     * ライブオークション状態を取得（参加者向け）
     */
    public function getLiveState(Auction $auction, ?int $userId = null): array
    {
        // 実装書 N1: lane.items の eager load を削除（過剰ロード対策）
        //   修正前: 'items' を with() で全件ロード → 1 lane に 100 件あれば 300 件 SELECT
        //   修正後: current_item と upcoming のみ別クエリで最小取得
        //   getLiveState は polling fallback で 5 秒ごとに呼ばれる可能性があり、
        //   120 接続 × 5 秒 = 24 req/秒 で 300 件読むのは DB 負荷大
        $lanes            = $auction->lanes()
            ->with(['currentItem.media', 'currentItem.sellerProfile', 'currentItem.sellerProfile.user:id,trade_name,profile_image_path'])
            ->orderBy('lane_number')
            ->get();
        $defaultCountdown = $auction->getAuctionSettings()['countdown_seconds'] ?? 3;

        // ★ N+1解消: 全アクティブアイテムのデータを一括取得
        $currentItemIds = $lanes->pluck('currentItem.id')->filter()->values()->toArray();

        // 実装書 N1: 各レーンの current_item の sequence_order を一括取得
        //   旧: $lane->items->where('id', $currentItemId)->first()?->pivot?->sequence_order
        //       → 全 items をロードする前提のロジック
        //   新: lane_items テーブルから直接 (lane_id, item_id) で sequence_order を取る
        $currentSeqByLane = !empty($currentItemIds)
            ? \DB::table('lane_items')
                ->whereIn('lane_id', $lanes->pluck('id'))
                ->whereIn('item_id', $currentItemIds)
                ->select('lane_id', 'sequence_order')
                ->get()
                ->keyBy('lane_id')
            : collect();

        // 実装書 N1: 各レーンの upcoming items（current より後の sequence_order の上位 3 件）を
        //   per-lane に最小取得。3 レーンなら計 3 クエリだが、各 9 行以下で軽量。
        $upcomingByLane = [];
        foreach ($lanes as $lane) {
            $currentSeqRow = $currentSeqByLane->get($lane->id);
            if (!$currentSeqRow) {
                $upcomingByLane[$lane->id] = collect();
                continue;
            }
            $currentSeq = (int) $currentSeqRow->sequence_order;

            $upcomingByLane[$lane->id] = \DB::table('lane_items')
                ->join('items', 'items.id', '=', 'lane_items.item_id')
                ->where('lane_items.lane_id', $lane->id)
                ->where('lane_items.sequence_order', '>', $currentSeq)
                ->where('items.status', 'registered')
                ->orderBy('lane_items.sequence_order', 'asc')
                ->limit(3)
                ->select(
                    'items.id', 'items.item_number', 'items.species_name', 'items.quantity',
                    'items.start_price', 'items.thumbnail_path', 'items.is_premium',
                    'items.is_anonymous',
                    'lane_items.sequence_order'
                )
                ->get();
        }

        // 入札者数を一括取得（GROUP BY item_id）
        $bidderCounts = !empty($currentItemIds)
            ? BidParticipant::whereIn('item_id', $currentItemIds)
                ->where('is_active', true)
                ->selectRaw('item_id, COUNT(*) as cnt')
                ->groupBy('item_id')
                ->pluck('cnt', 'item_id')
                ->toArray()
            : [];

        // 自分の入札状態を一括取得
        $myParticipants = ($userId && !empty($currentItemIds))
            ? BidParticipant::whereIn('item_id', $currentItemIds)
                ->where('user_id', $userId)
                ->get()
                ->keyBy('item_id')
            : collect();

        // 自分の指値を一括取得
        $myLimits = ($userId && !empty($currentItemIds))
            ? BidLimitPrice::whereIn('item_id', $currentItemIds)
                ->where('user_id', $userId)
                ->get()
                ->keyBy('item_id')
            : collect();

        // upcoming_items 用: 全レーンの upcoming item ID を収集（実装書 N1: $upcomingByLane を使用）
        $upcomingItemIds = [];
        foreach ($upcomingByLane as $items) {
            foreach ($items as $i) {
                $upcomingItemIds[] = (int) $i->id;
            }
        }

        $myUpcomingLimits = ($userId && !empty($upcomingItemIds))
            ? BidLimitPrice::whereIn('item_id', $upcomingItemIds)
                ->where('user_id', $userId)
                ->get()
                ->keyBy('item_id')
            : collect();

        $myUpcomingFavorites = ($userId && !empty($upcomingItemIds))
            ? Favorite::where('user_id', $userId)
                ->whereIn('item_id', $upcomingItemIds)
                ->pluck('item_id')
                ->flip()
            : collect();

        $lanesData = [];
        foreach ($lanes as $lane) {
            $laneData = [
                'lane_id'      => $lane->id,
                'lane_number'  => $lane->lane_number,
                'lane_name'    => $lane->lane_name,
                'status'       => $lane->status,
                'current_item' => null,
            ];

            if ($lane->currentItem) {
                $item              = $lane->currentItem;
                $activeBidderCount = $bidderCounts[$item->id] ?? 0;

                $myBidStatus = null;
                $myLimitPrice = null;
                $myLimitTriggered = false;
                if ($userId) {
                    $participant = $myParticipants->get($item->id);
                    $myBidStatus = $participant ? ($participant->is_active ? 'active' : 'inactive') : null;

                    $limit = $myLimits->get($item->id);
                    if ($limit) {
                        $myLimitPrice     = $limit->limit_price;
                        $myLimitTriggered = $limit->is_triggered;
                    }
                }

                $countdownState = Cache::get("countdown:lane:{$lane->id}");

                // Cache miss 復旧（負荷レビュー C4 指摘）:
                // Redis LRU eviction や瞬間的な network timeout でレーン単位に
                // null が返ると、ユーザーごとに「3秒のまま」表示される事故になる。
                // active レーン × 商品ライブ中 で cache が無い場合は、
                // CountdownService::startCountdown を呼んで再構築 → 再取得する。
                // 復旧自体が失敗しても、最後の保険として $defaultCountdown が走るが、
                // その前に必ず1度復旧を試みる。
                if (!$countdownState && $lane->status === 'active' && $lane->currentItem && $lane->currentItem->status === 'live') {
                    try {
                        app(\App\Services\CountdownService::class)->startCountdown($lane);
                        $countdownState = Cache::get("countdown:lane:{$lane->id}");
                        Log::warning('getLiveState: countdown cache miss recovered', [
                            'lane_id'   => $lane->id,
                            'item_id'   => $lane->currentItem->id,
                            'auction_id'=> $auction->id,
                        ]);
                    } catch (\Throwable $e) {
                        Log::error('getLiveState: countdown cache recovery failed', [
                            'lane_id' => $lane->id,
                            'error'   => $e->getMessage(),
                        ]);
                    }
                }

                $remainingSeconds = $countdownState['remaining_seconds'] ?? $defaultCountdown;
                $phase            = $countdownState['phase'] ?? 'bidding';
                $preBidRemaining  = $phase === 'pre_bid' ? ($countdownState['remaining_seconds'] ?? 0) : 0;
                $freezeTotal      = (float) ($countdownState['freeze_countdown_seconds'] ?? 1);
                $countdownMode    = $countdownState['countdown_mode'] ?? 'default';

                $isAnonCurrent = (bool) $item->is_anonymous;
                $laneData['current_item'] = [
                    'id'                       => $item->id,
                    'item_number'              => $item->item_number,
                    'species_name'             => $item->species_name,
                    // 屋号（users.trade_name）を直参照。未設定は null（フロントで「-」表示）。
                    'seller_name'              => $isAnonCurrent ? '匿名出品' : ($item->sellerProfile?->user?->trade_name ?? null),
                    'seller_profile_image_url' => $isAnonCurrent ? null : $item->sellerProfile?->profile_image_url,
                    'quantity'                 => $item->quantity,
                    'quantity_unit'            => $item->quantity_unit ?? 'fish',
                    'current_price'            => $item->current_price,
                    'estimated_price'          => $item->estimated_price, // @deprecated フロントエンドで未使用。互換のため残存。
                    'inspection_info'          => $item->inspection_info,
                    'individual_info'          => $item->individual_info,
                    'is_premium'               => $item->is_premium,
                    'is_anonymous'             => $isAnonCurrent,
                    'thumbnail_path'           => $item->thumbnail_path,
                    'media'                    => $this->transformMedia($item->media),
                    'active_bidders_count'     => $activeBidderCount,
                    'countdown_seconds'        => $remainingSeconds,
                    'my_bid_status'            => $myBidStatus,
                    'phase'                    => $phase,
                    'pre_bid_remaining_seconds'=> $preBidRemaining,
                    'countdown_mode'           => $countdownMode, // @deprecated フロントエンドで未使用。互換のため残存。
                    'countdown_seconds_competitive' => $countdownState['countdown_seconds_competitive'] ?? 1, // @deprecated フロントエンドで未使用。互換のため残存。
                    'freeze_countdown_seconds' => $freezeTotal,
                    'my_limit_price'           => $myLimitPrice,
                    'my_limit_triggered'       => $myLimitTriggered,
                ];
            }

            // upcoming items: 実装書 N1: 事前取得した $upcomingByLane を整形
            $upcomingItems = [];
            $laneUpcoming = $upcomingByLane[$lane->id] ?? collect();
            foreach ($laneUpcoming as $i) {
                $data = [
                    'id'             => (int) $i->id,
                    'item_number'    => $i->item_number,
                    'species_name'   => $i->species_name,
                    'quantity'       => $i->quantity,
                    'start_price'    => $i->start_price,
                    'thumbnail_path' => $i->thumbnail_path,
                    'is_premium'     => (bool) $i->is_premium,
                    'is_anonymous'   => (bool) $i->is_anonymous,
                ];
                if ($userId) {
                    $limit = $myUpcomingLimits->get($i->id);
                    $data['is_favorited']       = $myUpcomingFavorites->has($i->id);
                    $data['my_limit_price']     = $limit?->limit_price;
                    $data['my_limit_triggered'] = $limit?->is_triggered ?? false;
                }
                $upcomingItems[] = $data;
            }
            $laneData['upcoming_items'] = $upcomingItems;

            $lanesData[] = $laneData;
        }

        $auctionSettings = $auction->getAuctionSettings();

        return [
            'auction_id'    => $auction->id,
            'auction_title' => $auction->title,
            'status'        => $auction->status,
            'countdown_seconds' => $defaultCountdown,
            'price_increment_tiers' => $auction->getPriceIncrementTiers(),
            'countdown_tiers'       => $auction->getCountdownTiers(),
            'lanes'         => $lanesData,
        ];
    }

    /**
     * ユーザーのアクティブな入札一覧を取得
     */
    public function getActiveParticipations(int $userId): array
    {
        $participants = BidParticipant::forUser($userId)
            ->active()
            ->with(['item.auction'])
            ->get();

        $result = [];
        foreach ($participants as $participant) {
            $item = $participant->item;
            if ($item && $item->status === 'live') {
                $result[] = [
                    'participant_id' => $participant->id,
                    'item'    => [
                        'id'          => $item->id,
                        'item_number' => $item->item_number,
                        'species_name'=> $item->species_name,
                        'current_price'=> $item->current_price,
                        'quantity'    => $item->quantity,
                    ],
                    'auction' => [
                        'id'    => $item->auction->id,
                        'title' => $item->auction->title,
                    ],
                    'activated_at' => $participant->activated_at,
                ];
            }
        }

        return $result;
    }
}
