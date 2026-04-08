<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Auction\FinishAuctionAction;
use App\Actions\Auction\MoveToNextItemAction;
use App\Actions\Auction\PauseAuctionAction;
use App\Actions\Auction\ResumeAuctionAction;
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
use App\Jobs\ProcessAuctionCountdownJob;
use App\Events\LaneItemChanged;
use App\Events\AuctionStatusChanged;
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
        
        // Eager loading で N+1 クエリを解消（旧: オークションごとに5+クエリ → 3クエリに集約）
        $auctions = $query->orderBy('event_date', 'asc')
            ->with(['lanes', 'items'])
            ->withCount([
                'items as total_items',
                'items as registered_items' => fn ($q) => $q->where('status', 'registered'),
                'items as live_items' => fn ($q) => $q->where('status', 'live'),
                'items as sold_items' => fn ($q) => $q->where('status', 'sold'),
                'items as unsold_items' => fn ($q) => $q->where('status', 'unsold'),
            ])
            ->get()
            ->map(function ($auction) {
                $lanes = $auction->lanes;
                $activeLanes = $lanes->where('status', 'active')->count();

                // レーンに割り当て済みのアイテム数（eager loaded lanes から集計）
                $laneIds = $lanes->pluck('id');
                $assignedItems = $laneIds->isNotEmpty()
                    ? DB::table('lane_items')->whereIn('lane_id', $laneIds)->count()
                    : 0;

                return [
                    'id' => $auction->id,
                    'title' => $auction->title,
                    'event_date' => $auction->event_date->format('Y-m-d'),
                    'start_time' => $auction->start_time,
                    'status' => $auction->status,
                    'statistics' => [
                        'lane_count' => $lanes->count(),
                        'active_lanes' => $activeLanes,
                        'total_items' => $auction->total_items,
                        'registered_items' => $auction->registered_items,
                        'assigned_items' => $assignedItems,
                        'live_items' => $auction->live_items,
                        'sold_items' => $auction->sold_items,
                        'unsold_items' => $auction->unsold_items,
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

            // 各レーンの最初の商品をライブに（カウントダウンはまだ開始しない）
            $lanesToStart = [];
            foreach ($auction->lanes as $lane) {
                $nextItem = $this->startNextItem($lane, false); // カウントダウン開始は後で
                if ($nextItem) {
                    $lanesToStart[] = $lane->id;
                }
            }

            DB::commit();

            // 10秒カウントダウン開始をキャッシュに記録
            $countdownSeconds = 10;
            \Illuminate\Support\Facades\Cache::put(
                "auction:{$auction->id}:start_at",
                now()->addSeconds($countdownSeconds)->timestamp,
                120
            );

            // 開始予告イベントをブロードキャスト（カウントダウン付き）
            broadcast(new AuctionStatusChanged(
                $auction->id,
                'starting',
                'オークションが間もなく開始されます',
                $countdownSeconds
            ));

            // レーン情報をキャッシュに保存（ジョブ側でカウントダウン後に開始するため）
            \Illuminate\Support\Facades\Cache::put(
                "auction:{$auction->id}:lanes_to_start",
                $lanesToStart,
                120
            );

            // オークション全体のカウントダウンジョブをディスパッチ（1つで全レーン処理）
            ProcessAuctionCountdownJob::dispatch($auction->id);
            \Log::info("Dispatched auction countdown job for auction {$auction->id} with {$countdownSeconds}s pre-start countdown");

            return response()->json([
                'success' => true,
                'message' => 'オークションを開始しました。',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
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
     * レーンを作成（まだない場合）
     */
    private function createLanesIfNeeded(Auction $auction): void
    {
        if ($auction->lanes()->count() === 0) {
            $laneCount = $auction->lane_count ?: 1;
            for ($i = 1; $i <= $laneCount; $i++) {
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
        $lanes = $auction->lanes()->orderBy('lane_number')->get();
        $laneCount = $lanes->count();
        if ($laneCount === 0) return;

        // 既にいずれかのレーンに割り当て済みのアイテムを除外
        $unassigned = $auction->items()
            ->where('status', 'registered')
            ->whereNotIn('id', function ($q) use ($auction) {
                $q->select('item_id')->from('lane_items')
                  ->join('lanes', 'lane_items.lane_id', '=', 'lanes.id')
                  ->where('lanes.auction_id', $auction->id);
            })
            ->orderByDesc('is_premium')  // プレミアム生体を優先
            ->orderBy('item_number')
            ->get();

        if ($unassigned->isEmpty()) return;

        foreach ($unassigned as $index => $item) {
            $lane = $lanes[$index % $laneCount];
            $maxOrder = \DB::table('lane_items')->where('lane_id', $lane->id)->max('sequence_order') ?? 0;
            \DB::table('lane_items')->insert([
                'lane_id'        => $lane->id,
                'item_id'        => $item->id,
                'sequence_order' => $maxOrder + 1,
                'created_at'     => now(),
                'updated_at'     => now(),
            ]);
        }
    }

    /**
     * 次の商品を開始
     */
    private function startNextItem(Lane $lane, bool $startCountdown = true): ?Item
    {
        // 現在の商品があれば終了
        if ($lane->currentItem && $lane->currentItem->status === 'live') {
            $lane->currentItem->update(['status' => 'unsold']);
        }

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

            // カウントダウンを開始（オークション全体のジョブが処理するので、状態開始のみ）
            if ($startCountdown) {
                $this->countdownService->startCountdown($lane);
            }

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
