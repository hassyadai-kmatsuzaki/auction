<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Auction\FinishAuctionAction;
use App\Actions\Auction\MoveToNextItemAction;
use App\Actions\Auction\PauseAuctionAction;
use App\Actions\Auction\ResumeAuctionAction;
use App\Actions\Auction\StartAuctionAction;
use App\Actions\Auction\ToggleEntranceAction;
use App\Actions\Item\AdjustPriceAction;
use App\Services\AuctionService;
use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\Lane;
use App\Models\Item;
use App\Models\BidParticipant;
use App\Services\BidService;
use App\Services\CountdownService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class LiveController extends Controller
{
    public function __construct(
        protected BidService                   $bidService,
        protected CountdownService             $countdownService,
        private readonly PauseAuctionAction    $pauseAction,
        private readonly ResumeAuctionAction   $resumeAction,
        private readonly FinishAuctionAction   $finishAction,
        private readonly MoveToNextItemAction  $nextItemAction,
        private readonly StartAuctionAction    $startAction,
        private readonly AdjustPriceAction     $adjustPriceAction,
        private readonly ToggleEntranceAction  $toggleEntranceAction,
        private readonly AuctionService        $auctionService,
    ) {}


    /**
     * ライブ管理用オークション一覧
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function auctionList(Request $request)
    {
        // SQLite互換のorderBy
        $driver = config('database.default');
        $query = Auction::whereIn('status', ['preparing', 'scheduled', 'live']);
        
        if ($driver === 'sqlite') {
            $query->orderByRaw("CASE status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'preparing' THEN 2 ELSE 3 END");
        } else {
            $query->orderByRaw("FIELD(status, 'live', 'scheduled', 'preparing')");
        }
        
        $auctions = $query->orderBy('event_date', 'asc')
            ->get()
            ->map(function ($auction) {
                // レーン情報
                $lanes = Lane::where('auction_id', $auction->id)->get();
                $activeLanes = $lanes->where('status', 'active')->count();
                
                // アイテム統計
                $items = Item::where('auction_id', $auction->id);
                $totalItems = (clone $items)->count();
                $registeredItems = (clone $items)->where('status', 'registered')->count();
                $liveItems = (clone $items)->where('status', 'live')->count();
                $soldItems = (clone $items)->where('status', 'sold')->count();
                $unsoldItems = (clone $items)->where('status', 'unsold')->count();

                // レーンに割り当て済みのアイテム数
                $assignedItems = DB::table('lane_items')
                    ->join('lanes', 'lane_items.lane_id', '=', 'lanes.id')
                    ->where('lanes.auction_id', $auction->id)
                    ->count();

                return [
                    'id' => $auction->id,
                    'title' => $auction->title,
                    'event_date' => $auction->event_date->format('Y-m-d'),
                    'start_time' => $auction->start_time,
                    'status' => $auction->status,
                    'statistics' => [
                        'lane_count' => $lanes->count(),
                        'active_lanes' => $activeLanes,
                        'total_items' => $totalItems,
                        'registered_items' => $registeredItems,
                        'assigned_items' => $assignedItems,
                        'live_items' => $liveItems,
                        'sold_items' => $soldItems,
                        'unsold_items' => $unsoldItems,
                    ],
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'auctions' => $auctions,
            ],
        ]);
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
                    'exhibit_code' => $item->exhibit_code,
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
                ->orderBy('lane_items.sequence_order')
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'item_number' => $item->item_number,
                        'exhibit_code' => $item->exhibit_code,
                        'species_name' => $item->species_name,
                        'status' => $item->status,
                        'sequence' => $item->pivot->sequence_order,
                    ];
                });

            // 全商品（sold/unsold含む）
            $allItems = $lane->items()
                ->orderBy('lane_items.sequence_order')
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'item_number' => $item->item_number,
                        'exhibit_code' => $item->exhibit_code,
                        'species_name' => $item->species_name,
                        'quantity' => $item->quantity,
                        'start_price' => $item->start_price,
                        'current_price' => $item->current_price,
                        'status' => $item->status,
                        'is_premium' => $item->is_premium,
                        'thumbnail_path' => $item->thumbnail_path,
                        'sequence' => $item->pivot->sequence_order,
                    ];
                });

            $lanesData[] = [
                'lane_id' => $lane->id,
                'lane_number' => $lane->lane_number,
                'status' => $lane->status,
                'current_item' => $currentItemData,
                'queued_items' => $queuedItems,
                'queued_count' => $queuedItems->count(),
                'all_items' => $allItems,
                'all_items_count' => $allItems->count(),
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
                    'start_time' => $auction->start_time,
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
     * A-7 (2026-09-08): 開始処理を StartAuctionAction に一本化。
     *   旧実装はここに自動開始と同内容の別実装（レーン作成・割当・1商品目 live 化・Cache::put・dispatch）を
     *   持っており、自動開始と同じ秒に押されると1商品目が孤立していた。
     *   manual: true は「進行ジョブの heartbeat が 30 秒以上止まっている場合に限り、
     *   押し直しで start_at を上書きして復旧できる」挙動（旧 Cache::put の意図）を温存するためのもの。
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

        try {
            $this->startAction->start($auction, ['preparing', 'scheduled'], true);
        } catch (\Illuminate\Database\QueryException $e) {
            // QueryException は RuntimeException の子なので先に捕まえる。SQL 文言を画面に出さない。
            \Log::error('LiveController@start: DB error', ['auction_id' => $auction->id, 'error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'オークション開始中にエラーが発生しました。ログを確認してください。',
            ], 500);
        } catch (\RuntimeException $e) {
            // 状態不一致（同時押し・自動開始との競合）や商品ゼロなど、StartAuctionAction の事前検証
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }

        return response()->json([
            'success' => true,
            'message' => 'オークションを開始しました。',
        ]);
    }

    /** オークション一時停止 */
    public function pause($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);
        return $this->pauseAction->execute($auction)->toResponse();
    }

    /** オークション再開 */
    public function resume($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);
        return $this->resumeAction->execute($auction)->toResponse();
    }

    /** オークション終了 */
    public function finish($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);
        return $this->finishAction->execute($auction)->toResponse();
    }

    /** 次の商品へ進む（手動） */
    public function nextItem(Request $request, $laneId)
    {
        $lane = Lane::with(['auction', 'currentItem'])->findOrFail($laneId);
        return $this->nextItemAction->execute($lane)->toResponse();
    }

    /** 価格手動調整 */
    public function adjustPrice(Request $request, $itemId)
    {
        $validator = Validator::make($request->all(), ['new_price' => 'required|numeric|min:0']);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $item = Item::with('auction')->findOrFail($itemId);
        return $this->adjustPriceAction
            ->execute($item, (float) $request->new_price, $request->input('reason'), auth()->id())
            ->toResponse();
    }

    /**
     * カウントダウン状態を取得
     */
    public function countdownStatus($auctionId)
    {
        $countdowns = $this->countdownService->getActiveCountdowns($auctionId);

        return response()->json([
            'success' => true,
            'data' => ['countdowns' => $countdowns],
        ]);
    }

    /**
     * 待機室を手動公開する（scheduled ステータス専用）
     */
    public function openEntrance($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);
        return $this->toggleEntranceAction->execute($auction, true)->toResponse();
    }

    /**
     * 待機室を閉鎖して時間制御に戻す
     */
    public function closeEntrance($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);
        return $this->toggleEntranceAction->execute($auction, false)->toResponse();
    }

    /**
     * 待機室の現在の公開状態を取得
     */
    public function entranceStatus($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        return response()->json([
            'success' => true,
            'data'    => [
                'auction_id'      => $auction->id,
                'auction_status'  => $auction->status,
                'entrance_opened' => $this->auctionService->isEntranceManuallyOpened($auction->id),
            ],
        ]);
    }
}
