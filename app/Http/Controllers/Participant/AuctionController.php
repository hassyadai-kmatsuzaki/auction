<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\Item;
use App\Services\BidService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuctionController extends Controller
{
    protected BidService $bidService;

    public function __construct(BidService $bidService)
    {
        $this->bidService = $bidService;
    }

    /**
     * オークション一覧取得
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $status = $request->input('status');
        
        $query = Auction::query();
        
        // 参加者には準備中は見せない
        $query->whereIn('status', ['scheduled', 'live', 'finished']);
        
        if ($status && in_array($status, ['scheduled', 'live', 'finished'])) {
            $query->where('status', $status);
        }
        
        $auctions = $query->orderByRaw("FIELD(status, 'live', 'scheduled', 'finished')")
            ->orderBy('event_date', 'desc')
            ->get();
        
        return response()->json([
            'success' => true,
            'data' => [
                'auctions' => $auctions->map(function ($auction) {
                    return [
                        'id' => $auction->id,
                        'title' => $auction->title,
                        'event_date' => $auction->event_date->format('Y-m-d'),
                        'start_time' => $auction->start_time,
                        'status' => $auction->status,
                        'description' => $auction->description,
                        'lane_count' => $auction->lane_count,
                    ];
                }),
            ],
        ]);
    }

    /**
     * オークション詳細取得
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show($id)
    {
        $auction = Auction::findOrFail($id);
        
        // 参加者には準備中は見せない
        if ($auction->status === 'preparing') {
            return response()->json([
                'success' => false,
                'message' => 'オークションが見つかりません。',
            ], 404);
        }
        
        return response()->json([
            'success' => true,
            'data' => [
                'auction' => [
                    'id' => $auction->id,
                    'title' => $auction->title,
                    'event_date' => $auction->event_date->format('Y-m-d'),
                    'start_time' => $auction->start_time,
                    'status' => $auction->status,
                    'description' => $auction->description,
                    'lane_count' => $auction->lane_count,
                    'countdown_seconds' => $auction->countdown_seconds,
                ],
            ],
        ]);
    }

    /**
     * ライブオークション状態取得
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function live($id)
    {
        $auction = Auction::findOrFail($id);
        
        // ライブ中のみアクセス可能
        if ($auction->status !== 'live') {
            return response()->json([
                'success' => false,
                'message' => 'オークションは開催中ではありません。',
            ], 400);
        }
        
        $userId = Auth::id();
        $liveState = $this->bidService->getLiveState($auction, $userId);
        
        return response()->json([
            'success' => true,
            'data' => $liveState,
        ]);
    }

    /**
     * オークションの出品一覧取得（レーン情報付き）
     *
     * @param int $auctionId
     * @return \Illuminate\Http\JsonResponse
     */
    public function items($auctionId)
    {
        $auction = Auction::with(['lanes' => function ($query) {
            $query->orderBy('lane_number');
        }])->findOrFail($auctionId);
        
        // 参加者には準備中は見せない
        if ($auction->status === 'preparing') {
            return response()->json([
                'success' => false,
                'message' => 'オークションが見つかりません。',
            ], 404);
        }
        
        // レーンごとのアイテムを取得
        $lanes = $auction->lanes;
        $lanesData = [];
        
        foreach ($lanes as $lane) {
            // レーンに割り当てられたアイテムを取得
            $laneItems = $lane->items()
                ->whereIn('items.status', ['registered', 'live', 'sold', 'unsold'])
                ->with(['media' => function ($query) {
                    $query->orderBy('display_order');
                }])
                ->orderBy('lane_items.sequence_order')
                ->get();
            
            $lanesData[] = [
                'lane_number' => $lane->lane_number,
                'lane_name' => "レーン{$lane->lane_number}",
                'status' => $lane->status,
                'items' => $laneItems->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'item_number' => $item->item_number,
                        'species_name' => $item->species_name,
                        'quantity' => $item->quantity,
                        'start_price' => $item->start_price,
                        'current_price' => $item->current_price,
                        'estimated_price' => $item->estimated_price,
                        'inspection_info' => $item->inspection_info,
                        'individual_info' => $item->individual_info,
                        'is_premium' => $item->is_premium,
                        'thumbnail_path' => $item->thumbnail_path,
                        'status' => $item->status,
                        'media' => $item->media,
                    ];
                }),
            ];
        }
        
        // レーンに割り当てられていないアイテムも取得
        $unassignedItems = Item::where('auction_id', $auctionId)
            ->whereIn('status', ['registered', 'live', 'sold', 'unsold'])
            ->whereDoesntHave('lanes')
            ->with(['media' => function ($query) {
                $query->orderBy('display_order');
            }])
            ->orderBy('item_number')
            ->get();
        
        if ($unassignedItems->count() > 0) {
            $lanesData[] = [
                'lane_number' => 0,
                'lane_name' => '未割当',
                'status' => 'waiting',
                'items' => $unassignedItems->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'item_number' => $item->item_number,
                        'species_name' => $item->species_name,
                        'quantity' => $item->quantity,
                        'start_price' => $item->start_price,
                        'current_price' => $item->current_price,
                        'estimated_price' => $item->estimated_price,
                        'inspection_info' => $item->inspection_info,
                        'individual_info' => $item->individual_info,
                        'is_premium' => $item->is_premium,
                        'thumbnail_path' => $item->thumbnail_path,
                        'status' => $item->status,
                        'media' => $item->media,
                    ];
                }),
            ];
        }
        
        // 総アイテム数を計算
        $totalItems = array_sum(array_map(fn($l) => count($l['items']), $lanesData));
        
        return response()->json([
            'success' => true,
            'data' => [
                'auction' => [
                    'id' => $auction->id,
                    'title' => $auction->title,
                    'status' => $auction->status,
                    'event_date' => $auction->event_date->format('Y-m-d'),
                ],
                'lanes' => $lanesData,
                'total_items' => $totalItems,
            ],
        ]);
    }
}
