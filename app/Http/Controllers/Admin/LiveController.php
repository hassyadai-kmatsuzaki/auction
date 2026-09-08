<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Auction\FinishAuctionAction;
use App\Actions\Auction\MoveToNextItemAction;
use App\Actions\Auction\PauseAuctionAction;
use App\Actions\Auction\ResumeAuctionAction;
use App\Actions\Auction\StartAuctionAction;
use App\Actions\Auction\ToggleEntranceAction;
use App\Actions\Item\AdjustPriceAction;
use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\BidParticipant;
use App\Models\Item;
use App\Models\Lane;
use App\Services\AuctionService;
use App\Services\BidService;
use App\Services\CountdownService;
use App\Traits\MediaUrlTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * 管理画面・ライブ進行コントローラ
 *
 * 2026-09-08 (A-7): 開始処理を StartAuctionAction に一本化する過程で本ファイルの大半を
 * 誤って削除したため、ルート定義・LiveControllerTest・管理画面フロント
 * （pages/admin/LiveAuctions.tsx / LiveControl.tsx / features/live-control）が要求する
 * レスポンス契約から再構成した。本番に配置されている原本（md5 ec98cc97…、7/16 セットB）と
 * 突合し、差異があれば原本の挙動に合わせること。
 */
class LiveController extends Controller
{
    use MediaUrlTrait;

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
     * ライブ管理対象のオークション一覧（準備中・予定・開催中）と進捗統計
     */
    public function auctionList()
    {
        $auctions = Auction::whereIn('status', ['preparing', 'scheduled', 'live'])
            ->withCount([
                'lanes',
                'lanes as active_lanes_count' => fn ($q) => $q->where('status', 'active'),
                'items',
                'items as registered_items_count' => fn ($q) => $q->where('status', 'registered'),
                'items as sold_items_count'       => fn ($q) => $q->where('status', 'sold'),
                'items as unsold_items_count'     => fn ($q) => $q->where('status', 'unsold'),
                'items as live_items_count'       => fn ($q) => $q->where('status', 'live'),
            ])
            ->orderByRaw("CASE status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END")
            ->orderBy('event_date')
            ->orderBy('start_time')
            ->get();

        // レーン割当済み件数（lane_items）はオークション単位で一括取得
        $assignedByAuction = DB::table('lane_items')
            ->join('lanes', 'lane_items.lane_id', '=', 'lanes.id')
            ->whereIn('lanes.auction_id', $auctions->pluck('id'))
            ->selectRaw('lanes.auction_id, COUNT(*) as cnt')
            ->groupBy('lanes.auction_id')
            ->pluck('cnt', 'auction_id');

        $data = $auctions->map(function (Auction $a) use ($assignedByAuction) {
            return [
                'id'         => $a->id,
                'title'      => $a->title,
                'status'     => $a->status,
                'event_date' => $a->event_date,
                'start_time' => $a->start_time,
                'lane_count' => $a->lane_count,
                'is_published' => (bool) $a->is_published,
                'statistics' => [
                    'lane_count'       => (int) $a->lanes_count,
                    'active_lanes'     => (int) $a->active_lanes_count,
                    'total_items'      => (int) $a->items_count,
                    'registered_items' => (int) $a->registered_items_count,
                    'assigned_items'   => (int) ($assignedByAuction[$a->id] ?? 0),
                    'sold_items'       => (int) $a->sold_items_count,
                    'unsold_items'     => (int) $a->unsold_items_count,
                    'live_items'       => (int) $a->live_items_count,
                ],
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data'    => ['auctions' => $data],
        ]);
    }

    /**
     * ライブ管理画面の状態（オークション・レーン・全商品・統計）
     *
     * レーンの進行状態は参加者向けと同じ BidService::getLiveState を土台にし、
     * 管理者向けに「現在の入札者一覧」「レーン内の全商品」「商品統計」を足す。
     */
    public function show($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        $liveState = $this->bidService->getLiveState($auction);
        $lanes     = $auction->lanes()->orderBy('lane_number')->get()->keyBy('id');

        // 現在商品の入札者一覧（アクティブのみ・氏名付き）を一括取得
        $currentItemIds = collect($liveState['lanes'] ?? [])
            ->pluck('current_item.id')->filter()->values()->all();
        $biddersByItem = collect();
        if (!empty($currentItemIds)) {
            $biddersByItem = BidParticipant::whereIn('item_id', $currentItemIds)
                ->where('is_active', true)
                ->with('user:id,name,trade_name')
                ->orderBy('activated_at')
                ->get()
                ->groupBy('item_id');
        }

        $laneData = collect($liveState['lanes'] ?? [])->map(function (array $lane) use ($lanes, $biddersByItem) {
            $laneModel   = $lanes->get($lane['lane_id']);
            $currentItem = $lane['current_item'];

            if ($currentItem) {
                $currentItem['active_bidders'] = ($biddersByItem->get($currentItem['id']) ?? collect())
                    ->map(fn (BidParticipant $p) => [
                        'user_id'      => $p->user_id,
                        'user_name'    => $p->user?->trade_name ?: ($p->user?->name ?? "user#{$p->user_id}"),
                        'activated_at' => optional($p->activated_at)->toIso8601String(),
                    ])->values()->all();
            }

            // レーン内の全商品（並び順つき）
            $allItems = $laneModel
                ? $laneModel->items()->orderBy('lane_items.sequence_order')->get()
                : collect();
            $activeCounts = $allItems->isEmpty() ? collect() : BidParticipant::whereIn('item_id', $allItems->pluck('id'))
                ->where('is_active', true)
                ->selectRaw('item_id, COUNT(*) as cnt')
                ->groupBy('item_id')
                ->pluck('cnt', 'item_id');

            return [
                'lane_id'      => $lane['lane_id'],
                'lane_number'  => $lane['lane_number'],
                'lane_name'    => $lane['lane_name'] ?? null,
                'status'       => $lane['status'],
                'current_item' => $currentItem,
                // 管理画面のカードはレーン直下の countdown_seconds / phase を見る
                'countdown_seconds' => $currentItem['countdown_seconds'] ?? null,
                'phase'             => $currentItem['phase'] ?? null,
                'all_items'    => $allItems->map(fn (Item $i) => [
                    'id'                   => $i->id,
                    'item_number'          => $i->item_number,
                    'exhibit_code'         => $i->exhibit_code,
                    'species_name'         => $i->species_name,
                    'quantity'             => $i->quantity,
                    'start_price'          => $i->start_price,
                    'current_price'        => $i->current_price,
                    'status'               => $i->status,
                    'is_premium'           => (bool) $i->is_premium,
                    'thumbnail_path'       => $this->resolveMediaUrl($i->thumbnail_path),
                    'sequence'             => $i->pivot->sequence_order ?? null,
                    'active_bidders_count' => (int) ($activeCounts[$i->id] ?? 0),
                ])->values()->all(),
                'all_items_count' => $allItems->count(),
            ];
        })->values();

        $itemStats = [
            'total'      => (int) $auction->items()->count(),
            'registered' => (int) $auction->items()->where('status', 'registered')->count(),
            'live'       => (int) $auction->items()->where('status', 'live')->count(),
            'sold'       => (int) $auction->items()->where('status', 'sold')->count(),
            'unsold'     => (int) $auction->items()->where('status', 'unsold')->count(),
        ];

        return response()->json([
            'success' => true,
            'data'    => [
                'auction'    => [
                    'id'          => $auction->id,
                    'title'       => $auction->title,
                    'status'      => $auction->status,
                    'event_date'  => $auction->event_date,
                    'start_time'  => $auction->start_time,
                    'lane_count'  => $auction->lane_count,
                    'is_published' => (bool) $auction->is_published,
                    'is_test'     => (bool) $auction->is_test,
                ],
                'lanes'      => $laneData,
                'item_stats' => $itemStats,
            ],
        ]);
    }

    /**
     * オークション開始
     *
     * A-7 (2026-09-08): 開始処理は StartAuctionAction に一本化。
     *   旧実装はここに同じ内容の別実装（レーン作成・割当・1商品目 live 化・Cache::put・dispatch）
     *   があり、自動開始と同じ秒に押されると1商品目が孤立していた。
     *   manual: true により、進行ジョブが死んでいる場合に限り押し直しで復旧できる挙動は温存している。
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

        if ($auction->items()->count() === 0) {
            return response()->json([
                'success' => false,
                'message' => '商品が登録されていません。',
            ], 400);
        }

        try {
            $this->startAction->start($auction, ['preparing', 'scheduled'], true);
        } catch (\RuntimeException $e) {
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

    /** オークション終了（残りの商品は不成立） */
    public function finish($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);
        return $this->finishAction->execute($auction)->toResponse();
    }

    /**
     * 次の商品へ
     *
     * A-6 (2026-09-08): 入札者が2名以上のときは MoveToNextItemAction が失敗を返す
     * （旧実装は握りつぶして商品を宙に浮かせていた）。失敗理由はそのまま画面に出る。
     */
    public function nextItem($laneId)
    {
        $lane = Lane::with(['auction', 'currentItem'])->findOrFail($laneId);
        return $this->nextItemAction->execute($lane)->toResponse();
    }

    /**
     * 価格調整
     *
     * ⚠ live 中の使用は運用ルールで禁止（AdjustPriceAction はロック・カウントダウン連動なしの素 update）。
     */
    public function adjustPrice(Request $request, $itemId)
    {
        $validator = Validator::make($request->all(), [
            'new_price' => ['required', 'numeric', 'min:0'],
            'reason'    => ['nullable', 'string', 'max:255'],
        ]);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => '入力内容に誤りがあります。',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $item = Item::findOrFail($itemId);

        return $this->adjustPriceAction->execute(
            $item,
            (float) $request->input('new_price'),
            $request->input('reason'),
            $request->user()?->id
        )->toResponse();
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
