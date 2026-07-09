<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityEvent;
use App\Models\Auction;
use App\Models\Item;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * 管理: ユーザー行動分析。
 *
 * activity_events（閲覧/お気に入り/指値/会場入場/ログイン）+ bid_events（入札）+ users を集計。
 * is_test=true のユーザーは全集計から除外する（確定仕様）。PII を返すので admin 限定。
 */
class AdminAnalyticsController extends Controller
{
    /** 入札とみなす bid_events の種別（参加・値上げ）。 */
    private const BID_EVENT_TYPES = ['join', 'manual_raise', 'auto_raise', 'price_accept'];

    /**
     * オークション単位の KPI サマリー。
     * GET /api/admin/auctions/{auctionId}/analytics
     */
    public function auctionSummary(int $auctionId): JsonResponse
    {
        $auction = Auction::find($auctionId);
        if (!$auction) {
            return response()->json(['success' => false, 'message' => '対象のオークションが見つかりませんでした。'], 404);
        }

        // event_type ごとの件数・ユニークユーザー数を1クエリで
        $byType = ActivityEvent::query()
            ->where('auction_id', $auctionId)
            ->whereHas('user', fn ($q) => $q->where('is_test', false))
            ->selectRaw('event_type, COUNT(*) as cnt, COUNT(DISTINCT user_id) as uu')
            ->groupBy('event_type')
            ->get()
            ->keyBy('event_type');

        $cnt = fn (string $t) => (int) ($byType[$t]->cnt ?? 0);
        $uu  = fn (string $t) => (int) ($byType[$t]->uu ?? 0);

        // お気に入りの自動付与（指値副産物）分を分離
        $favAuto = (int) ActivityEvent::query()
            ->where('auction_id', $auctionId)
            ->where('event_type', ActivityEvent::FAVORITE_ADD)
            ->where('meta->auto', true)
            ->whereHas('user', fn ($q) => $q->where('is_test', false))
            ->count();
        $favAdd = $cnt(ActivityEvent::FAVORITE_ADD);

        // 入札（bid_events を items 経由でこのオークションに限定）
        $bidderUU = (int) DB::table('bid_events as be')
            ->join('items as it', 'it.id', '=', 'be.item_id')
            ->join('users as u', 'u.id', '=', 'be.user_id')
            ->where('it.auction_id', $auctionId)
            ->where('u.is_test', false)
            ->whereIn('be.event_type', self::BID_EVENT_TYPES)
            ->distinct()
            ->count('be.user_id');

        // 現時点のお気に入り数（favorites の net）
        $currentFav = (int) DB::table('favorites as f')
            ->join('items as it', 'it.id', '=', 'f.item_id')
            ->join('users as u', 'u.id', '=', 'f.user_id')
            ->where('it.auction_id', $auctionId)
            ->where('u.is_test', false)
            ->count();

        // 現時点の有効な指値件数
        $currentLimits = (int) DB::table('bid_limit_prices as bl')
            ->join('items as it', 'it.id', '=', 'bl.item_id')
            ->join('users as u', 'u.id', '=', 'bl.user_id')
            ->where('it.auction_id', $auctionId)
            ->where('u.is_test', false)
            ->count();

        return response()->json([
            'success' => true,
            'data' => [
                'auction' => [
                    'id'         => $auction->id,
                    'title'      => $auction->title,
                    'status'     => $auction->status,
                    'event_date' => optional($auction->event_date)->format('Y-m-d'),
                ],
                'metrics' => [
                    'item_view'        => ['count' => $cnt(ActivityEvent::ITEM_VIEW), 'unique_users' => $uu(ActivityEvent::ITEM_VIEW)],
                    'venue_enter'      => ['count' => $cnt(ActivityEvent::VENUE_ENTER), 'unique_users' => $uu(ActivityEvent::VENUE_ENTER)],
                    'favorite_add'     => ['count' => $favAdd, 'manual' => max(0, $favAdd - $favAuto), 'auto' => $favAuto, 'unique_users' => $uu(ActivityEvent::FAVORITE_ADD)],
                    'favorite_remove'  => ['count' => $cnt(ActivityEvent::FAVORITE_REMOVE)],
                    'favorite_current' => ['count' => $currentFav],
                    'bid_limit_set'    => ['count' => $cnt(ActivityEvent::BID_LIMIT_SET), 'unique_users' => $uu(ActivityEvent::BID_LIMIT_SET)],
                    'bid_limit_remove' => ['count' => $cnt(ActivityEvent::BID_LIMIT_REMOVE)],
                    'bid_limit_current'=> ['count' => $currentLimits],
                    'bidders'          => ['unique_users' => $bidderUU],
                ],
            ],
        ]);
    }

    /**
     * 生体（item）ごとの閲覧・お気に入り・指値ランキング。
     * GET /api/admin/auctions/{auctionId}/analytics/items
     */
    public function auctionItems(int $auctionId): JsonResponse
    {
        // 閲覧（活動ログ）
        $views = ActivityEvent::query()
            ->where('auction_id', $auctionId)
            ->where('event_type', ActivityEvent::ITEM_VIEW)
            ->whereHas('user', fn ($q) => $q->where('is_test', false))
            ->selectRaw('item_id, COUNT(*) as cnt, COUNT(DISTINCT user_id) as uu')
            ->groupBy('item_id')
            ->get()->keyBy('item_id');

        // 現時点のお気に入り数
        $favs = DB::table('favorites as f')
            ->join('users as u', 'u.id', '=', 'f.user_id')
            ->join('items as it', 'it.id', '=', 'f.item_id')
            ->where('it.auction_id', $auctionId)
            ->where('u.is_test', false)
            ->selectRaw('f.item_id, COUNT(*) as cnt')
            ->groupBy('f.item_id')->pluck('cnt', 'item_id');

        // 現時点の有効な指値数
        $limits = DB::table('bid_limit_prices as bl')
            ->join('users as u', 'u.id', '=', 'bl.user_id')
            ->join('items as it', 'it.id', '=', 'bl.item_id')
            ->where('it.auction_id', $auctionId)
            ->where('u.is_test', false)
            ->selectRaw('bl.item_id, COUNT(*) as cnt')
            ->groupBy('bl.item_id')->pluck('cnt', 'item_id');

        $items = Item::query()
            ->where('auction_id', $auctionId)
            ->orderBy('item_number')
            ->get(['id', 'item_number', 'exhibit_code', 'species_name']);

        $rows = $items->map(function ($it) use ($views, $favs, $limits) {
            return [
                'item_id'      => $it->id,
                'item_number'  => $it->item_number,
                'exhibit_code' => $it->exhibit_code,
                'species_name' => $it->species_name,
                'views'        => (int) ($views[$it->id]->cnt ?? 0),
                'view_users'   => (int) ($views[$it->id]->uu ?? 0),
                'favorites'    => (int) ($favs[$it->id] ?? 0),
                'bid_limits'   => (int) ($limits[$it->id] ?? 0),
            ];
        })
        ->sortByDesc(fn ($r) => [$r['views'], $r['favorites'], $r['bid_limits']])
        ->values();

        return response()->json(['success' => true, 'data' => ['items' => $rows]]);
    }

    /**
     * 「誰が」ドリルダウン。指定イベント（+item）を行ったユーザー一覧。
     * GET /api/admin/auctions/{auctionId}/analytics/users?event=item_view&item_id=101
     */
    public function auctionUsers(Request $request, int $auctionId): JsonResponse
    {
        $data = $request->validate([
            'event'   => 'required|string|in:item_view,venue_enter,favorite_add,favorite_remove,bid_limit_set,bid_limit_remove,bid',
            'item_id' => 'nullable|integer',
        ]);

        // 入札は bid_events から
        if ($data['event'] === 'bid') {
            $q = DB::table('bid_events as be')
                ->join('items as it', 'it.id', '=', 'be.item_id')
                ->join('users as u', 'u.id', '=', 'be.user_id')
                ->where('it.auction_id', $auctionId)
                ->where('u.is_test', false)
                ->whereIn('be.event_type', self::BID_EVENT_TYPES);
            if (!empty($data['item_id'])) {
                $q->where('be.item_id', $data['item_id']);
            }
            $users = $q->selectRaw('u.id, u.name, u.trade_name, u.email, COUNT(*) as cnt, MAX(be.created_at) as last_at')
                ->groupBy('u.id', 'u.name', 'u.trade_name', 'u.email')
                ->orderByDesc('cnt')->get();

            return response()->json(['success' => true, 'data' => ['users' => $users]]);
        }

        $q = DB::table('activity_events as ae')
            ->join('users as u', 'u.id', '=', 'ae.user_id')
            ->where('ae.auction_id', $auctionId)
            ->where('ae.event_type', $data['event'])
            ->where('u.is_test', false);
        if (!empty($data['item_id'])) {
            $q->where('ae.item_id', $data['item_id']);
        }
        $users = $q->selectRaw('u.id, u.name, u.trade_name, u.email, COUNT(*) as cnt, MAX(ae.created_at) as last_at')
            ->groupBy('u.id', 'u.name', 'u.trade_name', 'u.email')
            ->orderByDesc('cnt')->get();

        return response()->json(['success' => true, 'data' => ['users' => $users]]);
    }

    /**
     * 全体ダッシュボード（総数・期間内アクティブ・オークション横断比較）。
     * GET /api/admin/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
     */
    public function overview(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => 'nullable|date',
            'to'   => 'nullable|date',
        ]);
        $from = isset($data['from']) ? \Carbon\Carbon::parse($data['from'])->startOfDay() : now()->subDays(30)->startOfDay();
        $to   = isset($data['to'])   ? \Carbon\Carbon::parse($data['to'])->endOfDay()   : now()->endOfDay();

        // 総ユーザー数（テスト除外）
        $totalUsers = (int) DB::table('users')->where('is_test', false)->count();

        // 期間内アクティブUU（daily_access ベース）
        $activeUsers = (int) ActivityEvent::query()
            ->where('event_type', ActivityEvent::DAILY_ACCESS)
            ->whereBetween('created_at', [$from, $to])
            ->whereHas('user', fn ($q) => $q->where('is_test', false))
            ->distinct()->count('user_id');

        // 日次アクセス推移（daily_access のユニークユーザー数）
        $dailyTrend = ActivityEvent::query()
            ->where('event_type', ActivityEvent::DAILY_ACCESS)
            ->whereBetween('created_at', [$from, $to])
            ->whereHas('user', fn ($q) => $q->where('is_test', false))
            ->selectRaw('event_date as date, COUNT(DISTINCT user_id) as uu')
            ->groupBy('event_date')->orderBy('event_date')->get();

        // オークション横断比較（期間内の event_date を持つオークション）
        $auctions = Auction::query()
            ->whereBetween('event_date', [$from->toDateString(), $to->toDateString()])
            ->orderByDesc('event_date')
            ->get(['id', 'title', 'status', 'event_date']);

        // オークション別の主要指標をまとめて取得
        $auctionIds = $auctions->pluck('id')->all();
        $actAgg = empty($auctionIds) ? collect() : ActivityEvent::query()
            ->whereIn('auction_id', $auctionIds)
            ->whereHas('user', fn ($q) => $q->where('is_test', false))
            ->selectRaw('auction_id, event_type, COUNT(*) as cnt, COUNT(DISTINCT user_id) as uu')
            ->groupBy('auction_id', 'event_type')->get()->groupBy('auction_id');

        $bidAgg = empty($auctionIds) ? collect() : DB::table('bid_events as be')
            ->join('items as it', 'it.id', '=', 'be.item_id')
            ->join('users as u', 'u.id', '=', 'be.user_id')
            ->whereIn('it.auction_id', $auctionIds)
            ->where('u.is_test', false)
            ->whereIn('be.event_type', self::BID_EVENT_TYPES)
            ->selectRaw('it.auction_id, COUNT(DISTINCT be.user_id) as bidders')
            ->groupBy('it.auction_id')->pluck('bidders', 'auction_id');

        $comparison = $auctions->map(function ($a) use ($actAgg, $bidAgg) {
            $byType = collect($actAgg->get($a->id) ?? [])->keyBy('event_type');
            return [
                'auction_id'  => $a->id,
                'title'       => $a->title,
                'status'      => $a->status,
                'event_date'  => optional($a->event_date)->format('Y-m-d'),
                'item_view_uu'=> (int) ($byType[ActivityEvent::ITEM_VIEW]->uu ?? 0),
                'venue_enter' => (int) ($byType[ActivityEvent::VENUE_ENTER]->cnt ?? 0),
                'favorites'   => (int) ($byType[ActivityEvent::FAVORITE_ADD]->cnt ?? 0),
                'bid_limits'  => (int) ($byType[ActivityEvent::BID_LIMIT_SET]->cnt ?? 0),
                'bidders'     => (int) ($bidAgg[$a->id] ?? 0),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'range'        => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
                'total_users'  => $totalUsers,
                'active_users' => $activeUsers,
                'daily_trend'  => $dailyTrend,
                'auctions'     => $comparison,
            ],
        ]);
    }
}
