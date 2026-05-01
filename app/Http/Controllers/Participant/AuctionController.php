<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\Item;
use App\Models\WonItem;
use App\Services\AuctionService;
use App\Services\BidService;
use App\Services\TestModeService;
use App\Traits\MediaUrlTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuctionController extends Controller
{
    use MediaUrlTrait;

    public function __construct(
        private readonly BidService     $bidService,
        private readonly AuctionService $auctionService,
        private readonly TestModeService $testMode,
    ) {}


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
        $this->testMode->applyToAuctionQuery($query);

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
        
        // 各オークションに紐づく出品者(生産者)名のユニークリストを一括取得
        $auctionIds = $auctions->pluck('id')->all();
        $sellersByAuction = [];
        if (!empty($auctionIds)) {
            $rowsQuery = Item::query()
                ->whereIn('auction_id', $auctionIds)
                ->whereIn('status', ['registered', 'live', 'sold', 'unsold']);
            $this->testMode->applyToItemQuery($rowsQuery);
            $rows = $rowsQuery
                ->join('seller_profiles', 'items.seller_profile_id', '=', 'seller_profiles.id')
                ->select('items.auction_id', 'seller_profiles.seller_name')
                ->distinct()
                ->get();
            foreach ($rows as $row) {
                if (!empty($row->seller_name)) {
                    $sellersByAuction[$row->auction_id][] = $row->seller_name;
                }
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'auctions' => $auctions->map(function ($auction) use ($sellersByAuction) {
                    $data = [
                        'id'          => $auction->id,
                        'title'       => $auction->title,
                        'event_date'  => $auction->event_date->format('Y-m-d'),
                        'start_time'  => $auction->start_time,
                        'status'      => $auction->status,
                        'description' => $auction->description,
                        'lane_count'  => $auction->lane_count,
                        'entrance_allowed' => null, // scheduled 以外は null
                        'sellers'     => array_values(array_unique($sellersByAuction[$auction->id] ?? [])),
                    ];

                    // scheduled の場合のみ入室可否を付与
                    if ($auction->status === 'scheduled') {
                        $entrance = $this->auctionService->resolveEntranceState($auction);
                        $data['entrance_allowed'] = $entrance['entrance_allowed'] ?? false;
                    }

                    return $data;
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
        $auctionQuery = Auction::query()->where('id', $id);
        $this->testMode->applyToAuctionQuery($auctionQuery);
        $auction = $auctionQuery->first();
        if (!$auction) {
            return response()->json(['success' => false, 'message' => 'オークションが見つかりません。'], 404);
        }

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
     */
    public function live($id)
    {
        $auctionQuery = Auction::query()->where('id', $id);
        $this->testMode->applyToAuctionQuery($auctionQuery);
        $auction = $auctionQuery->first();
        if (!$auction) {
            return response()->json(['success' => false, 'message' => 'オークションが見つかりません。'], 404);
        }

        // 待機室: scheduledステータスの場合
        if ($auction->status === 'scheduled') {
            $entrance = $this->auctionService->resolveEntranceState($auction);

            $base = [
                'auction_id'    => $auction->id,
                'auction_title' => $auction->title,
                'status'        => 'scheduled',
                'countdown_seconds' => 0,
                'price_increment_tiers' => $auction->getPriceIncrementTiers(),
                'countdown_tiers'       => $auction->getCountdownTiers(),
                'lanes'         => [],
            ];

            if (!$entrance['entrance_allowed']) {
                return response()->json(['success' => true, 'data' => array_merge($base, $entrance)]);
            }

            return response()->json(['success' => true, 'data' => array_merge($base, [
                'entrance_allowed'   => true,
                'start_at'           => $entrance['start_at'],
                'show_consent_screen'=> $this->auctionService->shouldShowConsentScreen(),
            ])]);
        }

        // ライブ中 or 終了済み
        if (!in_array($auction->status, ['live', 'finished'])) {
            return response()->json(['success' => false, 'message' => 'オークションは開催中ではありません。'], 400);
        }

        $liveState = $this->bidService->getLiveState($auction, Auth::id());
        $liveState['show_consent_screen'] = $this->auctionService->shouldShowConsentScreen();

        $startingCountdown = $this->auctionService->getStartingCountdown($auction->id);
        if ($startingCountdown !== null) {
            $liveState['status']             = 'starting';
            $liveState['starting_countdown'] = $startingCountdown;
        }

        return response()->json(['success' => true, 'data' => $liveState]);
    }

    /**
     * オークション内の自分の落札一覧を取得
     */
    public function myWonItems($auctionId)
    {
        $userId = Auth::id();

        $wonItemsQuery = WonItem::where('winner_id', $userId)
            ->whereHas('item', function ($q) use ($auctionId) {
                $q->where('auction_id', $auctionId);
            })
            ->with('item');
        $this->testMode->applyToWonItemQuery($wonItemsQuery);
        $wonItems = $wonItemsQuery->get();
        
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
        $auctionQuery = Auction::query()->where('id', $auctionId)
            ->with(['lanes' => function ($query) {
                $query->orderBy('lane_number');
            }]);
        $this->testMode->applyToAuctionQuery($auctionQuery);
        $auction = $auctionQuery->first();
        if (!$auction) {
            return response()->json(['success' => false, 'message' => 'オークションが見つかりません。'], 404);
        }

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
            $laneItemsQuery = $lane->items()
                ->whereIn('items.status', ['registered', 'live', 'sold', 'unsold'])
                ->with([
                    'media' => function ($query) {
                        $query->orderBy('display_order');
                    },
                    'sellerProfile:id,seller_name,profile_image_path',
                ]);
            $this->testMode->applyToItemQuery($laneItemsQuery);
            $laneItems = $laneItemsQuery
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
                        'seller_name' => $item->sellerProfile?->seller_name,
                        'seller_profile_image_url' => $item->sellerProfile?->profile_image_url,
                        'media' => $this->transformMedia($item->media),
                    ];
                }),
            ];
        }

        // レーンに割り当てられていないアイテムも取得
        $unassignedItemsQuery = Item::where('auction_id', $auctionId)
            ->whereIn('status', ['registered', 'live', 'sold', 'unsold'])
            ->whereDoesntHave('lanes')
            ->with([
                'media' => function ($query) {
                    $query->orderBy('display_order');
                },
                'sellerProfile:id,seller_name',
            ]);
        $this->testMode->applyToItemQuery($unassignedItemsQuery);
        $unassignedItems = $unassignedItemsQuery
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
                        'seller_name' => $item->sellerProfile?->seller_name,
                        'seller_profile_image_url' => $item->sellerProfile?->profile_image_url,
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
