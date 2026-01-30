<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\Lane;
use App\Models\Item;
use App\Models\BidParticipant;
use App\Services\BidService;
use App\Events\LaneItemChanged;
use App\Events\AuctionStatusChanged;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class LiveController extends Controller
{
    protected BidService $bidService;

    public function __construct(BidService $bidService)
    {
        $this->bidService = $bidService;
    }

    /**
     * ライブオークション状態取得（管理者用）
     *
     * @param int $auctionId
     * @return \Illuminate\Http\JsonResponse
     */
    public function show($auctionId)
    {
        $auction = Auction::with(['lanes.currentItem.media'])->findOrFail($auctionId);

        $lanesData = [];
        foreach ($auction->lanes()->orderBy('lane_number')->get() as $lane) {
            $currentItemData = null;
            
            if ($lane->currentItem) {
                $item = $lane->currentItem;
                $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();
                
                // アクティブな入札者一覧を取得
                $activeBidders = BidParticipant::forItem($item->id)
                    ->active()
                    ->with('user:id,name')
                    ->get()
                    ->map(function ($p) {
                        return [
                            'user_id' => $p->user_id,
                            'user_name' => $p->user->name ?? '不明',
                            'activated_at' => $p->activated_at->toIso8601String(),
                        ];
                    });

                $currentItemData = [
                    'id' => $item->id,
                    'item_number' => $item->item_number,
                    'species_name' => $item->species_name,
                    'quantity' => $item->quantity,
                    'start_price' => $item->start_price,
                    'current_price' => $item->current_price,
                    'estimated_price' => $item->estimated_price,
                    'status' => $item->status,
                    'is_premium' => $item->is_premium,
                    'thumbnail_path' => $item->thumbnail_path,
                    'active_bidders_count' => $activeBidderCount,
                    'active_bidders' => $activeBidders,
                ];
            }

            // レーンに割り当てられた商品を取得
            $queuedItems = $lane->items()
                ->whereIn('status', ['registered', 'live'])
                ->orderBy('lane_items.sequence')
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'item_number' => $item->item_number,
                        'species_name' => $item->species_name,
                        'status' => $item->status,
                        'sequence' => $item->pivot->sequence,
                    ];
                });

            $lanesData[] = [
                'lane_id' => $lane->id,
                'lane_number' => $lane->lane_number,
                'status' => $lane->status,
                'current_item' => $currentItemData,
                'queued_items' => $queuedItems,
                'queued_count' => $queuedItems->count(),
            ];
        }

        // 今日の商品統計
        $itemStats = [
            'total' => $auction->items()->count(),
            'registered' => $auction->items()->where('status', 'registered')->count(),
            'live' => $auction->items()->where('status', 'live')->count(),
            'sold' => $auction->items()->where('status', 'sold')->count(),
            'unsold' => $auction->items()->where('status', 'unsold')->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'auction' => [
                    'id' => $auction->id,
                    'title' => $auction->title,
                    'status' => $auction->status,
                    'event_date' => $auction->event_date->format('Y-m-d'),
                    'start_time' => $auction->start_time ? $auction->start_time->format('H:i') : null,
                    'countdown_seconds' => $auction->countdown_seconds,
                    'default_bid_increment' => $auction->default_bid_increment,
                ],
                'lanes' => $lanesData,
                'item_stats' => $itemStats,
            ],
        ]);
    }

    /**
     * オークション開始
     *
     * @param int $auctionId
     * @return \Illuminate\Http\JsonResponse
     */
    public function start($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => 'このオークションは開始できません。',
            ], 400);
        }

        // 商品があるか確認
        if ($auction->items()->count() === 0) {
            return response()->json([
                'success' => false,
                'message' => '商品が登録されていません。',
            ], 400);
        }

        DB::beginTransaction();
        try {
            // レーンを作成（まだない場合）
            $this->createLanesIfNeeded($auction);

            // 商品をレーンに割り当て
            $this->assignItemsToLanes($auction);

            // オークションを開始
            $auction->update(['status' => 'live']);

            // 各レーンの最初の商品をライブに
            foreach ($auction->lanes as $lane) {
                $this->startNextItem($lane);
            }

            DB::commit();

            // ステータス変更イベントをブロードキャスト
            broadcast(new AuctionStatusChanged($auction->id, 'live', 'オークションが開始されました'));

            return response()->json([
                'success' => true,
                'message' => 'オークションを開始しました。',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * オークション一時停止
     *
     * @param int $auctionId
     * @return \Illuminate\Http\JsonResponse
     */
    public function pause($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        if ($auction->status !== 'live') {
            return response()->json([
                'success' => false,
                'message' => '開催中のオークションのみ一時停止できます。',
            ], 400);
        }

        // 全レーンを一時停止
        $auction->lanes()->update(['status' => 'paused']);

        // ステータス変更イベントをブロードキャスト
        broadcast(new AuctionStatusChanged($auction->id, 'paused', 'オークションが一時停止されました'));

        return response()->json([
            'success' => true,
            'message' => '全レーンを一時停止しました。',
        ]);
    }

    /**
     * オークション再開
     *
     * @param int $auctionId
     * @return \Illuminate\Http\JsonResponse
     */
    public function resume($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        if ($auction->status !== 'live') {
            return response()->json([
                'success' => false,
                'message' => '開催中のオークションのみ再開できます。',
            ], 400);
        }

        // 全レーンを再開
        $auction->lanes()->where('status', 'paused')->update(['status' => 'active']);

        // ステータス変更イベントをブロードキャスト
        broadcast(new AuctionStatusChanged($auction->id, 'resumed', 'オークションが再開されました'));

        return response()->json([
            'success' => true,
            'message' => '全レーンを再開しました。',
        ]);
    }

    /**
     * オークション終了
     *
     * @param int $auctionId
     * @return \Illuminate\Http\JsonResponse
     */
    public function finish($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        if ($auction->status !== 'live') {
            return response()->json([
                'success' => false,
                'message' => '開催中のオークションのみ終了できます。',
            ], 400);
        }

        DB::beginTransaction();
        try {
            // 残っているライブ商品を不成立にする
            $auction->items()->where('status', 'live')->update(['status' => 'unsold']);

            // 全レーンを終了
            $auction->lanes()->update(['status' => 'finished', 'current_item_id' => null]);

            // オークションを終了
            $auction->update([
                'status' => 'finished',
                'end_time' => now()->format('H:i:s'),
            ]);

            DB::commit();

            // ステータス変更イベントをブロードキャスト
            broadcast(new AuctionStatusChanged($auction->id, 'finished', 'オークションが終了しました'));

            return response()->json([
                'success' => true,
                'message' => 'オークションを終了しました。',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * 次の商品へ進む（手動）
     *
     * @param Request $request
     * @param int $laneId
     * @return \Illuminate\Http\JsonResponse
     */
    public function nextItem(Request $request, $laneId)
    {
        $lane = Lane::with(['auction', 'currentItem'])->findOrFail($laneId);
        $auction = $lane->auction;

        if ($auction->status !== 'live') {
            return response()->json([
                'success' => false,
                'message' => 'オークションが開催中ではありません。',
            ], 400);
        }

        DB::beginTransaction();
        try {
            $previousItemId = $lane->current_item_id;
            $previousItem = $lane->currentItem;

            // 現在の商品を落札処理
            if ($previousItem && $previousItem->status === 'live') {
                $result = $this->bidService->finalizeBid($previousItem);
            }

            // 次の商品を開始
            $nextItem = $this->startNextItem($lane);

            DB::commit();

            // レーン変更イベントをブロードキャスト
            $currentItemData = null;
            if ($nextItem) {
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
                ];
            }

            broadcast(new LaneItemChanged(
                $auction->id,
                $lane->id,
                $lane->lane_number,
                $previousItemId,
                $currentItemData
            ));

            return response()->json([
                'success' => true,
                'message' => '次の商品に進みました。',
                'data' => [
                    'lane_id' => $lane->id,
                    'previous_item_id' => $previousItemId,
                    'current_item' => $currentItemData,
                ],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * 価格手動調整
     *
     * @param Request $request
     * @param int $itemId
     * @return \Illuminate\Http\JsonResponse
     */
    public function adjustPrice(Request $request, $itemId)
    {
        $validator = Validator::make($request->all(), [
            'new_price' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $item = Item::with('auction')->findOrFail($itemId);

        if ($item->status !== 'live') {
            return response()->json([
                'success' => false,
                'message' => 'ライブ中の商品のみ価格調整できます。',
            ], 400);
        }

        $oldPrice = $item->current_price;
        $newPrice = $request->new_price;

        $item->update(['current_price' => $newPrice]);

        // 価格イベントを記録
        \App\Models\PriceEvent::recordManualAdjustment(
            $item->id,
            $oldPrice,
            $newPrice,
            auth()->id(),
            ['reason' => $request->input('reason', '手動調整')]
        );

        // 価格更新イベントをブロードキャスト
        $lane = Lane::where('current_item_id', $item->id)->first();
        if ($lane) {
            $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();
            broadcast(new \App\Events\PriceUpdated(
                $item->auction->id,
                $lane->id,
                $item->id,
                $newPrice,
                $activeBidderCount,
                $item->auction->countdown_seconds
            ));
        }

        return response()->json([
            'success' => true,
            'message' => '価格を調整しました。',
            'data' => [
                'item_id' => $item->id,
                'old_price' => $oldPrice,
                'new_price' => $newPrice,
            ],
        ]);
    }

    /**
     * レーンを作成（まだない場合）
     */
    private function createLanesIfNeeded(Auction $auction): void
    {
        if ($auction->lanes()->count() === 0) {
            for ($i = 1; $i <= $auction->lane_count; $i++) {
                Lane::create([
                    'auction_id' => $auction->id,
                    'lane_number' => $i,
                    'status' => 'waiting',
                ]);
            }
        }
    }

    /**
     * 商品をレーンに割り当て
     * プレミアム生体を優先的に上位に配置
     */
    private function assignItemsToLanes(Auction $auction): void
    {
        // プレミアム生体を先に、その後に通常生体を取得
        $premiumItems = $auction->items()
            ->where('status', 'registered')
            ->where('is_premium', true)
            ->orderBy('item_number')
            ->get();

        $normalItems = $auction->items()
            ->where('status', 'registered')
            ->where(function ($q) {
                $q->where('is_premium', false)
                  ->orWhereNull('is_premium');
            })
            ->orderBy('item_number')
            ->get();

        // プレミアム生体を先に、通常生体を後ろに結合
        $items = $premiumItems->concat($normalItems);

        $lanes = $auction->lanes()->orderBy('lane_number')->get();
        $laneCount = $lanes->count();

        if ($laneCount === 0) {
            return;
        }

        $itemIndex = 0;
        foreach ($items as $item) {
            $laneIndex = $itemIndex % $laneCount;
            $lane = $lanes[$laneIndex];
            $sequence = floor($itemIndex / $laneCount) + 1;

            // すでに割り当てられていない場合のみ
            if (!$lane->items()->where('item_id', $item->id)->exists()) {
                $lane->items()->attach($item->id, [
                    'sequence' => $sequence,
                    'status' => 'pending',
                ]);
            }

            $itemIndex++;
        }
    }

    /**
     * 次の商品を開始
     */
    private function startNextItem(Lane $lane): ?Item
    {
        // 現在の商品があれば終了
        if ($lane->currentItem && $lane->currentItem->status === 'live') {
            $lane->currentItem->update(['status' => 'unsold']);
        }

        // 次の商品を取得
        $nextItem = $lane->items()
            ->where('status', 'registered')
            ->orderBy('lane_items.sequence')
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

            return $nextItem;
        } else {
            // 商品がなければレーンを終了
            $lane->update([
                'current_item_id' => null,
                'status' => 'finished',
            ]);

            return null;
        }
    }
}
