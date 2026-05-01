<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\WonItem;
use App\Services\TestModeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function __construct(private readonly TestModeService $testMode) {}

    /**
     * ダッシュボードデータ取得
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $user = Auth::user();

        // テストモード中、閉じた世界外の出品者にはダッシュボードを空で返す（401/403 にはしない）
        if ($this->testMode->isEnabled() && !$this->testMode->currentUserCanSeeTestUniverse($user)) {
            return response()->json([
                'success' => true,
                'data' => [
                    'stats' => [
                        'total_items' => 0, 'items_this_month' => 0,
                        'total_sales' => 0, 'sales_this_month' => 0,
                        'pending_items' => 0, 'sold_items' => 0,
                    ],
                    'recent_items' => [],
                    'upcoming_auctions' => [],
                    'test_mode_notice' => '現在テスト運用中のため、出品データは表示されません。',
                ],
            ]);
        }

        $profile = SellerProfile::where('user_id', $user->id)->first();

        if (!$profile) {
            return response()->json([
                'success' => false,
                'message' => '出品者情報が見つかりません。',
            ], 404);
        }

        // 統計情報
        $stats = $this->getStats($profile);

        // 開催予定オークション
        $upcomingAuctions = $this->getUpcomingAuctions();

        // 最近の出品
        $recentItems = $this->getRecentItems($profile);

        return response()->json([
            'success' => true,
            'data' => [
                'profile' => [
                    'seller_name' => $profile->seller_name,
                    'seller_code' => $profile->seller_code,
                ],
                'stats' => $stats,
                'upcoming_auctions' => $upcomingAuctions,
                'recent_items' => $recentItems,
            ],
        ]);
    }

    /**
     * 統計情報を取得
     */
    protected function getStats(SellerProfile $profile): array
    {
        $now = now();
        $startOfMonth = $now->copy()->startOfMonth();

        // 総出品数
        $totalItems = Item::where('seller_profile_id', $profile->id)->count();

        // 今月の出品数
        $itemsThisMonth = Item::where('seller_profile_id', $profile->id)
            ->where('created_at', '>=', $startOfMonth)
            ->count();

        // 総売上（落札済みのみ）
        $totalSales = DB::table('items')
            ->join('won_items', 'items.id', '=', 'won_items.item_id')
            ->where('items.seller_profile_id', $profile->id)
            ->sum('won_items.winning_price');

        // 今月の売上
        $salesThisMonth = DB::table('items')
            ->join('won_items', 'items.id', '=', 'won_items.item_id')
            ->where('items.seller_profile_id', $profile->id)
            ->where('won_items.created_at', '>=', $startOfMonth)
            ->sum('won_items.winning_price');

        // 入金待ち金額
        $pendingPayment = DB::table('items')
            ->join('won_items', 'items.id', '=', 'won_items.item_id')
            ->where('items.seller_profile_id', $profile->id)
            ->where('won_items.payment_status', 'pending')
            ->sum('won_items.winning_price');

        // 入金待ち件数
        $pendingPaymentCount = DB::table('items')
            ->join('won_items', 'items.id', '=', 'won_items.item_id')
            ->where('items.seller_profile_id', $profile->id)
            ->where('won_items.payment_status', 'pending')
            ->count();

        // 発送待ち件数
        $itemsShipping = DB::table('items')
            ->join('won_items', 'items.id', '=', 'won_items.item_id')
            ->where('items.seller_profile_id', $profile->id)
            ->where('won_items.payment_status', 'confirmed')
            ->where('won_items.delivery_status', 'pending')
            ->count();

        return [
            'total_items' => $totalItems,
            'items_this_month' => $itemsThisMonth,
            'total_sales' => (int) $totalSales,
            'sales_this_month' => (int) $salesThisMonth,
            'pending_payment' => (int) $pendingPayment,
            'pending_payment_count' => $pendingPaymentCount,
            'items_shipping' => $itemsShipping,
        ];
    }

    /**
     * 開催予定オークションを取得
     * 
     * 出品者ダッシュボードに表示するオークション:
     * - scheduled（予定/出品受付中）のみを表示
     * - preparing（準備中）は管理者のみ、finished/cancelled/liveは表示しない
     */
    protected function getUpcomingAuctions(): array
    {
        $auctions = Auction::where('event_date', '>=', now()->toDateString())
            ->where('status', 'scheduled') // 出品受付中のもののみ表示
            ->orderBy('event_date')
            ->limit(5)
            ->get();

        return $auctions->map(function ($auction) {
            // 出品申込締切日を計算（開催日の5日前をデフォルトとする）
            $deadline = $auction->event_date->copy()->subDays(5);
            $isAccepting = now()->lessThan($deadline);

            return [
                'id' => $auction->id,
                'title' => $auction->title,
                'date' => $auction->event_date->format('Y-m-d'),
                'deadline' => $deadline->format('Y-m-d'),
                'status' => $isAccepting ? 'accepting' : 'upcoming',
            ];
        })->toArray();
    }

    /**
     * 最近の出品を取得
     */
    protected function getRecentItems(SellerProfile $profile): array
    {
        $items = Item::where('seller_profile_id', $profile->id)
            ->with(['auction:id,title', 'wonItem:id,item_id,winning_price,payment_status,delivery_status'])
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        return $items->map(function ($item) {
            $status = $item->status;
            $price = null;
            $buyer = null;

            // 落札情報がある場合
            if ($item->wonItem) {
                $status = $item->wonItem->delivery_status === 'pending' ? 'shipping' : 'sold';
                $price = $item->wonItem->winning_price;
            }

            return [
                'id' => $item->id,
                'species_name' => $item->species_name,
                'quantity' => $item->quantity . '匹',
                'auction' => $item->auction ? $item->auction->title : '-',
                'auction_date' => $item->auction ? $item->auction->event_date : null,
                'status' => $status,
                'start_price' => $item->start_price,
                'final_price' => $price,
                'submitted_at' => $item->created_at->format('Y-m-d'),
            ];
        })->toArray();
    }
}
