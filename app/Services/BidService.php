<?php

namespace App\Services;

use App\Models\Auction;
use App\Models\BidLimitPrice;
use App\Models\BidParticipant;
use App\Traits\MediaUrlTrait;
use Illuminate\Support\Facades\Cache;

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
        $lanes            = $auction->lanes()->with(['currentItem.media'])->orderBy('lane_number')->get();
        $defaultCountdown = $auction->getAuctionSettings()['countdown_seconds'] ?? 3;

        // ★ N+1解消: 全アクティブアイテムのデータを一括取得
        $currentItemIds = $lanes->pluck('currentItem.id')->filter()->values()->toArray();

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

                $countdownState   = Cache::get("countdown:lane:{$lane->id}");
                $remainingSeconds = $countdownState['remaining_seconds'] ?? $defaultCountdown;
                $phase            = $countdownState['phase'] ?? 'bidding';
                $preBidRemaining  = $phase === 'pre_bid' ? ($countdownState['remaining_seconds'] ?? 0) : 0;
                $countdownMode    = $countdownState['countdown_mode'] ?? 'default';

                $laneData['current_item'] = [
                    'id'                       => $item->id,
                    'item_number'              => $item->item_number,
                    'species_name'             => $item->species_name,
                    'quantity'                 => $item->quantity,
                    'quantity_unit'            => $item->quantity_unit ?? 'fish',
                    'current_price'            => $item->current_price,
                    'estimated_price'          => $item->estimated_price,
                    'inspection_info'          => $item->inspection_info,
                    'individual_info'          => $item->individual_info,
                    'is_premium'               => $item->is_premium,
                    'thumbnail_path'           => $item->thumbnail_path,
                    'media'                    => $this->transformMedia($item->media),
                    'active_bidders_count'     => $activeBidderCount,
                    'countdown_seconds'        => $remainingSeconds,
                    'my_bid_status'            => $myBidStatus,
                    'phase'                    => $phase,
                    'pre_bid_remaining_seconds'=> $preBidRemaining,
                    'countdown_mode'           => $countdownMode,
                    'countdown_seconds_competitive' => $countdownState['countdown_seconds_competitive'] ?? 1,
                    'my_limit_price'           => $myLimitPrice,
                    'my_limit_triggered'       => $myLimitTriggered,
                ];
            }

            $lanesData[] = $laneData;
        }

        return [
            'auction_id'    => $auction->id,
            'auction_title' => $auction->title,
            'status'        => $auction->status,
            'countdown_seconds' => $defaultCountdown,
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
