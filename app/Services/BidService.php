<?php

namespace App\Services;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\BidParticipant;
use App\Models\BidEvent;
use App\Models\PriceEvent;
use App\Models\WonItem;
use App\Events\PriceUpdated;
use App\Events\BidderUpdated;
use App\Events\LaneItemChanged;
use App\Events\ItemSold;
use App\Events\AuctionStatusChanged;
use App\Traits\MediaUrlTrait;
use Illuminate\Support\Facades\DB;

class BidService
{
    use MediaUrlTrait;

    protected ?CountdownService $countdownService = null;

    /**
     * CountdownServiceを設定（循環参照回避のため）
     */
    public function setCountdownService(CountdownService $countdownService): void
    {
        $this->countdownService = $countdownService;
    }

    /**
     * 入札参加（ONボタン）
     *
     * @param Item $item
     * @param int $userId
     * @param string|null $ipAddress
     * @param string|null $userAgent
     * @return array
     */
    public function join(Item $item, int $userId, ?string $ipAddress = null, ?string $userAgent = null): array
    {
        // 商品がライブ中でなければエラー
        if ($item->status !== 'live') {
            return [
                'success' => false,
                'message' => 'この商品は現在入札を受け付けていません。',
            ];
        }

        // オークションがライブ中でなければエラー
        $auction = $item->auction;
        if ($auction->status !== 'live') {
            return [
                'success' => false,
                'message' => 'オークションが開催中ではありません。',
            ];
        }

        DB::beginTransaction();
        try {
            // 入札参加状態を更新
            $participant = BidParticipant::participate(
                $item->id,
                $userId,
                true,
                $ipAddress,
                $userAgent
            );

            // イベントを記録
            BidEvent::recordJoin(
                $item->id,
                $userId,
                $item->current_price,
                $ipAddress,
                $userAgent
            );

            // アクティブな入札者数を取得
            $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();

            DB::commit();

            // 入札者更新イベントをブロードキャスト
            $lane = Lane::where('current_item_id', $item->id)->first();
            if ($lane) {
                broadcast(new BidderUpdated(
                    $auction->id,
                    $lane->id,
                    $item->id,
                    $activeBidderCount,
                    'joined'
                ))->toOthers();
            }

            return [
                'success' => true,
                'message' => '入札に参加しました。',
                'data' => [
                    'participant_id' => $participant->id,
                    'item_id' => $item->id,
                    'is_active' => true,
                    'current_price' => $item->current_price,
                    'active_bidder_count' => $activeBidderCount,
                ],
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * 入札離脱（OFFボタン）
     *
     * @param Item $item
     * @param int $userId
     * @param string|null $ipAddress
     * @param string|null $userAgent
     * @return array
     */
    public function leave(Item $item, int $userId, ?string $ipAddress = null, ?string $userAgent = null): array
    {
        // 商品がライブ中でなければエラー
        if ($item->status !== 'live') {
            return [
                'success' => false,
                'message' => 'この商品は現在入札を受け付けていません。',
            ];
        }

        DB::beginTransaction();
        try {
            // 参加状態を取得
            $participant = BidParticipant::forItem($item->id)->forUser($userId)->first();
            
            if (!$participant || !$participant->is_active) {
                DB::rollBack();
                return [
                    'success' => false,
                    'message' => '入札に参加していません。',
                ];
            }

            // 入札参加状態を更新
            $participant->deactivate();

            // イベントを記録
            BidEvent::recordLeave(
                $item->id,
                $userId,
                $item->current_price,
                $ipAddress,
                $userAgent
            );

            // アクティブな入札者数を取得
            $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();

            DB::commit();

            // 入札者更新イベントをブロードキャスト
            $auction = $item->auction;
            $lane = Lane::where('current_item_id', $item->id)->first();
            if ($lane) {
                broadcast(new BidderUpdated(
                    $auction->id,
                    $lane->id,
                    $item->id,
                    $activeBidderCount,
                    'left'
                ))->toOthers();
            }

            return [
                'success' => true,
                'message' => '入札から離脱しました。',
                'data' => [
                    'item_id' => $item->id,
                    'is_active' => false,
                    'current_price' => $item->current_price,
                    'active_bidder_count' => $activeBidderCount,
                ],
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * 入札ON/OFF切り替え
     *
     * @param Item $item
     * @param int $userId
     * @param bool $isActive
     * @param string|null $ipAddress
     * @param string|null $userAgent
     * @return array
     */
    public function toggle(Item $item, int $userId, bool $isActive, ?string $ipAddress = null, ?string $userAgent = null): array
    {
        if ($isActive) {
            return $this->join($item, $userId, $ipAddress, $userAgent);
        } else {
            return $this->leave($item, $userId, $ipAddress, $userAgent);
        }
    }

    /**
     * 価格上昇処理
     *
     * @param Item $item
     * @return array
     */
    public function incrementPrice(Item $item): array
    {
        if ($item->status !== 'live') {
            return [
                'success' => false,
                'message' => 'この商品は現在ライブ中ではありません。',
            ];
        }

        $auction = $item->auction;
        $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();

        // 入札者が1人以下の場合は価格上昇しない
        if ($activeBidderCount <= 1) {
            return [
                'success' => false,
                'message' => '価格上昇の条件を満たしていません。',
                'data' => [
                    'active_bidder_count' => $activeBidderCount,
                ],
            ];
        }

        DB::beginTransaction();
        try {
            $oldPrice = $item->current_price;
            
            // 価格上昇額を計算
            $incrementRate = $auction->getPriceIncrementRate();
            $incrementMin = $auction->getPriceIncrementMin();
            
            $calculatedIncrement = $oldPrice * ($incrementRate / 100);
            $increment = max($calculatedIncrement, $incrementMin);
            $newPrice = $oldPrice + $increment;

            // 商品価格を更新
            $item->update(['current_price' => $newPrice]);

            // 価格イベントを記録
            PriceEvent::recordAutoIncrement(
                $item->id,
                $oldPrice,
                $newPrice,
                $activeBidderCount
            );

            DB::commit();

            // 価格更新イベントをブロードキャスト
            $lane = Lane::where('current_item_id', $item->id)->first();
            if ($lane) {
                broadcast(new PriceUpdated(
                    $auction->id,
                    $lane->id,
                    $item->id,
                    $newPrice,
                    $activeBidderCount,
                    $auction->getAuctionSettings()['countdown_seconds'] ?? 3
                ));
            }

            return [
                'success' => true,
                'message' => '価格が上昇しました。',
                'data' => [
                    'item_id' => $item->id,
                    'old_price' => $oldPrice,
                    'new_price' => $newPrice,
                    'increment' => $increment,
                    'active_bidder_count' => $activeBidderCount,
                ],
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * 落札処理
     *
     * @param Item $item
     * @return array
     */
    public function finalizeBid(Item $item): array
    {
        if ($item->status !== 'live') {
            return [
                'success' => false,
                'message' => 'この商品は現在ライブ中ではありません。',
            ];
        }

        $activeParticipants = BidParticipant::forItem($item->id)->active()->get();
        $activeBidderCount = $activeParticipants->count();

        // 入札者がいない場合は不成立
        if ($activeBidderCount === 0) {
            return $this->finalizeAsUnsold($item);
        }

        // 入札者が1人の場合は落札
        if ($activeBidderCount === 1) {
            return $this->finalizeAsSold($item, $activeParticipants->first()->user_id);
        }

        // 複数人の場合はまだ継続（価格上昇待ち）
        return [
            'success' => false,
            'message' => '複数の入札者がいます。価格上昇を待ってください。',
            'data' => [
                'active_bidder_count' => $activeBidderCount,
            ],
        ];
    }

    /**
     * 落札確定処理
     *
     * @param Item $item
     * @param int $winnerId
     * @return array
     */
    private function finalizeAsSold(Item $item, int $winnerId): array
    {
        DB::beginTransaction();
        try {
            $auction = $item->auction;
            $finalPrice = $item->current_price;

            // 商品ステータスを更新
            $item->update(['status' => 'sold']);

            // 落札レコードを作成
            $commissionRate = $auction->getFeeSettings()['buyer_commission_rate'];
            $commissionAmount = $auction->calculateBuyerCommission($finalPrice * $item->quantity);
            $totalAmount = ($finalPrice * $item->quantity) + $commissionAmount;
            $sellerCommission = $auction->calculateSellerCommission($finalPrice * $item->quantity);
            $sellerAmount = ($finalPrice * $item->quantity) - $sellerCommission;

            $wonItem = WonItem::create([
                'item_id' => $item->id,
                'winner_id' => $winnerId,
                'winning_price' => $finalPrice,
                'quantity' => $item->quantity,
                'total_amount' => $totalAmount,
                'commission_rate' => $commissionRate,
                'commission_amount' => $commissionAmount,
                'seller_amount' => $sellerAmount,
                'payment_status' => 'pending',
                'delivery_status' => 'pending',
                'payment_deadline' => now()->addHours($auction->payment_deadline_hours),
            ]);

            // 落札イベントを記録
            BidEvent::recordWin($item->id, $winnerId, $finalPrice);
            PriceEvent::recordItemSold($item->id, $finalPrice, $winnerId);

            // 他の参加者に落札失敗イベントを記録
            $otherParticipants = BidParticipant::forItem($item->id)
                ->where('user_id', '!=', $winnerId)
                ->get();
            foreach ($otherParticipants as $participant) {
                BidEvent::recordLose($item->id, $participant->user_id, $finalPrice);
            }

            DB::commit();

            // 落札イベントをブロードキャスト
            $lane = Lane::where('current_item_id', $item->id)->first();
            if ($lane) {
                broadcast(new ItemSold(
                    $auction->id,
                    $lane->id,
                    $item->id,
                    $winnerId,
                    $finalPrice,
                    $item->species_name ?? '',
                    $item->item_number ?? 0,
                    $item->quantity ?? 1
                ));
            }

            return [
                'success' => true,
                'message' => '落札が確定しました。',
                'data' => [
                    'item_id' => $item->id,
                    'winner_id' => $winnerId,
                    'winning_price' => $finalPrice,
                    'total_amount' => $totalAmount,
                    'won_item_id' => $wonItem->id,
                ],
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * 不成立処理
     *
     * @param Item $item
     * @return array
     */
    private function finalizeAsUnsold(Item $item): array
    {
        DB::beginTransaction();
        try {
            $item->update(['status' => 'unsold']);

            DB::commit();

            return [
                'success' => true,
                'message' => '入札者がいなかったため、不成立となりました。',
                'data' => [
                    'item_id' => $item->id,
                    'status' => 'unsold',
                ],
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * ライブオークション状態を取得
     *
     * @param Auction $auction
     * @param int|null $userId
     * @return array
     */
    public function getLiveState(Auction $auction, ?int $userId = null): array
    {
        // レーン情報を取得
        $lanes = $auction->lanes()->with(['currentItem.media'])->orderBy('lane_number')->get();
        
        // カウントダウン設定を取得
        $defaultCountdown = $auction->getAuctionSettings()['countdown_seconds'] ?? 3;

        $lanesData = [];
        foreach ($lanes as $lane) {
            $laneData = [
                'lane_id' => $lane->id,
                'lane_number' => $lane->lane_number,
                'status' => $lane->status,
                'current_item' => null,
            ];

            if ($lane->currentItem) {
                $item = $lane->currentItem;
                $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();
                
                $myBidStatus = null;
                if ($userId) {
                    $participant = BidParticipant::forItem($item->id)->forUser($userId)->first();
                    $myBidStatus = $participant ? ($participant->is_active ? 'active' : 'inactive') : null;
                }
                
                // リアルタイムカウントダウン秒数を取得
                $countdownState = \Illuminate\Support\Facades\Cache::get("countdown:lane:{$lane->id}");
                $remainingSeconds = $countdownState['remaining_seconds'] ?? $defaultCountdown;

                $laneData['current_item'] = [
                    'id' => $item->id,
                    'item_number' => $item->item_number,
                    'species_name' => $item->species_name,
                    'quantity' => $item->quantity,
                    'current_price' => $item->current_price,
                    'estimated_price' => $item->estimated_price,
                    'inspection_info' => $item->inspection_info,
                    'individual_info' => $item->individual_info,
                    'is_premium' => $item->is_premium,
                    'thumbnail_path' => $item->thumbnail_path,
                    'media' => $this->transformMedia($item->media),
                    'active_bidders_count' => $activeBidderCount,
                    'countdown_seconds' => $remainingSeconds,
                    'my_bid_status' => $myBidStatus,
                ];
            }

            $lanesData[] = $laneData;
        }

        return [
            'auction_id' => $auction->id,
            'auction_title' => $auction->title,
            'status' => $auction->status,
            'countdown_seconds' => $defaultCountdown,
            'lanes' => $lanesData,
        ];
    }

    /**
     * ユーザーのアクティブな入札一覧を取得
     *
     * @param int $userId
     * @return array
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
            if ($item->status === 'live') {
                $result[] = [
                    'participant_id' => $participant->id,
                    'item' => [
                        'id' => $item->id,
                        'item_number' => $item->item_number,
                        'species_name' => $item->species_name,
                        'current_price' => $item->current_price,
                        'quantity' => $item->quantity,
                    ],
                    'auction' => [
                        'id' => $item->auction->id,
                        'title' => $item->auction->title,
                    ],
                    'activated_at' => $participant->activated_at,
                ];
            }
        }

        return $result;
    }
}
