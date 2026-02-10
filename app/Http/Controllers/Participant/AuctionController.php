<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SystemSetting;
use App\Models\WonItem;
use App\Services\BidService;
use App\Traits\MediaUrlTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;

class AuctionController extends Controller
{
    use MediaUrlTrait;

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
        
        // SQLite互換のorderBy（MySQLのFIELD関数の代替）
        $driver = config('database.default');
        if ($driver === 'sqlite') {
            $auctions = $query->orderByRaw("CASE status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'finished' THEN 2 ELSE 3 END")
                ->orderBy('event_date', 'desc')
                ->get();
        } else {
            $auctions = $query->orderByRaw("FIELD(status, 'live', 'scheduled', 'finished')")
                ->orderBy('event_date', 'desc')
                ->get();
        }
        
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
        
        // 待機室: scheduledステータスの場合
        if ($auction->status === 'scheduled') {
            // 入室可能時刻を判定
            $auctionSettings = $auction->getAuctionSettings();
            $venueOpenMinutes = $auctionSettings['venue_open_minutes_before_start'] ?? 30;
            $startDateTime = \Carbon\Carbon::parse($auction->event_date->format('Y-m-d') . ' ' . $auction->start_time);
            $entranceAt = $startDateTime->copy()->subMinutes($venueOpenMinutes);
            $now = now();
            
            if ($now->lt($entranceAt)) {
                // 入室不可
                return response()->json([
                    'success' => true,
                    'data' => [
                        'auction_id' => $auction->id,
                        'auction_title' => $auction->title,
                        'status' => 'scheduled',
                        'entrance_allowed' => false,
                        'entrance_at' => $entranceAt->toIso8601String(),
                        'start_at' => $startDateTime->toIso8601String(),
                        'venue_open_minutes_before_start' => $venueOpenMinutes,
                        'message' => "オークション開始{$venueOpenMinutes}分前から入室できます",
                        'countdown_seconds' => 0,
                        'lanes' => [],
                    ],
                ]);
            }
            
            return response()->json([
                'success' => true,
                'data' => [
                    'auction_id' => $auction->id,
                    'auction_title' => $auction->title,
                    'status' => 'scheduled',
                    'entrance_allowed' => true,
                    'start_at' => $startDateTime->toIso8601String(),
                    'countdown_seconds' => 0,
                    'show_consent_screen' => SystemSetting::get('show_consent_screen', false),
                    'lanes' => [],
                ],
            ]);
        }
        
        // ライブ中 or 終了済み
        if (!in_array($auction->status, ['live', 'finished'])) {
            return response()->json([
                'success' => false,
                'message' => 'オークションは開催中ではありません。',
            ], 400);
        }
        
        $userId = Auth::id();
        $liveState = $this->bidService->getLiveState($auction, $userId);
        
        // 同意画面の表示設定を追加
        $liveState['show_consent_screen'] = SystemSetting::get('show_consent_screen', false);
        
        // 開始カウントダウン中かチェック
        $startAt = Cache::get("auction:{$auction->id}:start_at");
        if ($startAt) {
            $remaining = max(0, $startAt - now()->timestamp);
            if ($remaining > 0) {
                $liveState['status'] = 'starting';
                $liveState['starting_countdown'] = $remaining;
            }
        }
        
        return response()->json([
            'success' => true,
            'data' => $liveState,
        ]);
    }

    /**
     * オークション内の自分の落札一覧を取得
     */
    public function myWonItems($auctionId)
    {
        $userId = Auth::id();
        
        $wonItems = WonItem::where('winner_id', $userId)
            ->whereHas('item', function ($q) use ($auctionId) {
                $q->where('auction_id', $auctionId);
            })
            ->with('item')
            ->get();
        
        $totalAmount = 0;
        $items = $wonItems->map(function ($wi) use (&$totalAmount) {
            $totalAmount += $wi->total_amount;
            return [
                'id' => $wi->id,
                'item_number' => $wi->item->item_number,
                'species_name' => $wi->item->species_name,
                'quantity' => $wi->item->quantity,
                'quantity_unit' => $wi->item->quantity_unit ?? 'fish',
                'winning_price' => $wi->winning_price,
                'total_amount' => $wi->total_amount,
            ];
        });
        
        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items,
                'total_amount' => $totalAmount,
                'count' => $wonItems->count(),
            ],
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
                        'quantity_unit' => $item->quantity_unit ?? 'fish',
                        'start_price' => $item->start_price,
                        'current_price' => $item->current_price,
                        'estimated_price' => $item->estimated_price,
                        'inspection_info' => $item->inspection_info,
                        'individual_info' => $item->individual_info,
                        'is_premium' => $item->is_premium,
                        'thumbnail_path' => $item->thumbnail_path,
                        'status' => $item->status,
                        'media' => $this->transformMedia($item->media),
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
                        'quantity_unit' => $item->quantity_unit ?? 'fish',
                        'start_price' => $item->start_price,
                        'current_price' => $item->current_price,
                        'estimated_price' => $item->estimated_price,
                        'inspection_info' => $item->inspection_info,
                        'individual_info' => $item->individual_info,
                        'is_premium' => $item->is_premium,
                        'thumbnail_path' => $item->thumbnail_path,
                        'status' => $item->status,
                        'media' => $this->transformMedia($item->media),
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
