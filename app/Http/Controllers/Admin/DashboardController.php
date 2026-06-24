<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SpeciesThumbnailView;
use App\Models\WonItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * ダッシュボード統計取得
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function index()
    {
        $today = Carbon::today();
        $thisMonth = Carbon::now()->startOfMonth();

        // 基本統計
        $stats = [
            // オークション統計
            'auctions' => [
                'total' => Auction::count(),
                'this_month' => Auction::where('created_at', '>=', $thisMonth)->count(),
                'live' => Auction::where('status', 'live')->count(),
                'upcoming' => Auction::where('status', 'scheduled')->count(),
            ],
            // 売上統計
            'sales' => [
                'total' => WonItem::sum('total_amount'),
                'this_month' => WonItem::where('created_at', '>=', $thisMonth)->sum('total_amount'),
                'today' => WonItem::whereDate('created_at', $today)->sum('total_amount'),
            ],
            // 落札統計
            'won_items' => [
                'total' => WonItem::count(),
                'this_month' => WonItem::where('created_at', '>=', $thisMonth)->count(),
                'pending_payment' => WonItem::where('payment_status', 'pending')->count(),
                'pending_shipment' => WonItem::whereIn('payment_status', ['paid', 'confirmed'])
                    ->whereIn('delivery_status', ['pending', 'preparing'])
                    ->count(),
            ],
            // ユーザー統計
            'users' => [
                'total' => User::count(),
                'pending_approval' => User::where('status', 'pending')->count(),
                'active' => User::where('status', 'approved')->count(),
            ],
            // 撮影ビュー未設定の生体名（サムネが上見デフォルトのまま放置される地雷の検知用）
            'thumbnail_views' => [
                'unregistered' => SpeciesThumbnailView::unregisteredItemsQuery()
                    ->distinct()
                    ->count('species_name'),
            ],
        ];

        // 承認待ちユーザー一覧
        $pendingUsers = User::where('status', 'pending')
            ->orderBy('created_at', 'desc')
            ->take(5)
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'created_at' => $user->created_at->toIso8601String(),
                ];
            });

        // 開催予定・開催中のオークション（SQLite互換）
        $driver = config('database.default');
        $upcomingQuery = Auction::whereIn('status', ['scheduled', 'live']);
        
        if ($driver === 'sqlite') {
            $upcomingQuery->orderByRaw("CASE status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END");
        } else {
            $upcomingQuery->orderByRaw("FIELD(status, 'live', 'scheduled')");
        }
        
        $upcomingAuctions = $upcomingQuery->orderBy('event_date')
            ->take(5)
            ->get()
            ->map(function ($auction) {
                return [
                    'id' => $auction->id,
                    'title' => $auction->title,
                    'event_date' => $auction->event_date->format('Y-m-d'),
                    'start_time' => $auction->start_time,
                    'status' => $auction->status,
                    'items_count' => $auction->items()->count(),
                ];
            });

        // 月別売上データ（過去6ヶ月）（SQLite 互換）
        $dateExpr = $driver === 'sqlite'
            ? "strftime('%Y-%m', created_at)"
            : 'DATE_FORMAT(created_at, "%Y-%m")';
        $monthlySales = WonItem::select(
            DB::raw("{$dateExpr} as month"),
            DB::raw('SUM(total_amount) as total'),
            DB::raw('COUNT(*) as count')
        )
            ->where('created_at', '>=', Carbon::now()->subMonths(6)->startOfMonth())
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->map(function ($item) {
                return [
                    'month' => $item->month,
                    'total' => (float) $item->total,
                    'count' => (int) $item->count,
                ];
            });

        // 最近のアクティビティ
        $recentActivity = $this->getRecentActivity();

        return response()->json([
            'success' => true,
            'data' => [
                'statistics' => $stats,
                'pending_users' => $pendingUsers,
                'upcoming_auctions' => $upcomingAuctions,
                'monthly_sales' => $monthlySales,
                'recent_activity' => $recentActivity,
            ],
        ]);
    }

    /**
     * 最近のアクティビティを取得
     */
    private function getRecentActivity(): array
    {
        $activities = [];

        // 最近の落札
        $recentWonItems = WonItem::with(['item', 'winner'])
            ->orderBy('created_at', 'desc')
            ->take(5)
            ->get();

        foreach ($recentWonItems as $wonItem) {
            $activities[] = [
                'type' => 'won_item',
                'message' => ($wonItem->winner->name ?? '不明') . 'さんが「' . $wonItem->item->species_name . '」を落札',
                'amount' => $wonItem->total_amount,
                'created_at' => $wonItem->created_at->toIso8601String(),
            ];
        }

        // 最近のユーザー登録
        $recentUsers = User::where('status', 'pending')
            ->orderBy('created_at', 'desc')
            ->take(3)
            ->get();

        foreach ($recentUsers as $user) {
            $activities[] = [
                'type' => 'user_registration',
                'message' => $user->name . 'さんが登録申請',
                'created_at' => $user->created_at->toIso8601String(),
            ];
        }

        // 日時でソート
        usort($activities, function ($a, $b) {
            return strtotime($b['created_at']) - strtotime($a['created_at']);
        });

        return array_slice($activities, 0, 10);
    }

    /**
     * 売上サマリー取得
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function salesSummary(Request $request)
    {
        $period = $request->input('period', 'month'); // day, week, month, year

        switch ($period) {
            case 'day':
                $startDate = Carbon::today();
                break;
            case 'week':
                $startDate = Carbon::now()->startOfWeek();
                break;
            case 'year':
                $startDate = Carbon::now()->startOfYear();
                break;
            case 'month':
            default:
                $startDate = Carbon::now()->startOfMonth();
                break;
        }

        $wonItems = WonItem::where('created_at', '>=', $startDate)
            ->with(['item.auction']);

        $totalSales = (clone $wonItems)->sum('total_amount');
        $totalCount = (clone $wonItems)->count();
        $averagePrice = $totalCount > 0 ? $totalSales / $totalCount : 0;

        // オークション別売上
        $salesByAuction = WonItem::select('items.auction_id')
            ->selectRaw('SUM(won_items.total_amount) as total')
            ->selectRaw('COUNT(*) as count')
            ->join('items', 'won_items.item_id', '=', 'items.id')
            ->where('won_items.created_at', '>=', $startDate)
            ->groupBy('items.auction_id')
            ->with(['item.auction'])
            ->get()
            ->map(function ($item) {
                $auction = Auction::find($item->auction_id);
                return [
                    'auction_id' => $item->auction_id,
                    'auction_title' => $auction ? $auction->title : '不明',
                    'total' => (float) $item->total,
                    'count' => (int) $item->count,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'period' => $period,
                'start_date' => $startDate->toIso8601String(),
                'total_sales' => $totalSales,
                'total_count' => $totalCount,
                'average_price' => $averagePrice,
                'sales_by_auction' => $salesByAuction,
            ],
        ]);
    }
}
