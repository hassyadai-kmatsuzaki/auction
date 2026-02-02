<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\WonItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class SettlementController extends Controller
{
    /**
     * 売上・精算情報取得
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function index()
    {
        $seller = Auth::user();
        $sellerProfile = $seller->sellerProfile;
        
        if (!$sellerProfile) {
            return response()->json([
                'success' => false,
                'message' => '出品者プロフィールが見つかりません。',
            ], 404);
        }
        
        $sellerProfileId = $sellerProfile->id;

        // 自分の出品商品の落札情報を集計（オークション単位）
        $settlementsRaw = WonItem::select(
            'items.auction_id',
            DB::raw('SUM(won_items.total_amount) as total_sales'),
            DB::raw('SUM(won_items.commission_amount) as total_commission'),
            DB::raw('SUM(won_items.seller_amount) as total_net'),
            DB::raw('COUNT(*) as items_count')
        )
            ->join('items', 'won_items.item_id', '=', 'items.id')
            ->where('items.seller_profile_id', $sellerProfileId)
            ->groupBy('items.auction_id')
            ->with(['item.auction'])
            ->get();

        // オークションごとの精算情報を整形
        $settlements = [];
        foreach ($settlementsRaw as $row) {
            $auction = Auction::find($row->auction_id);
            if (!$auction) continue;

            // 精算ステータスを判定（オークション終了後1週間で精算完了と仮定）
            $auctionEndDate = $auction->event_date;
            $paymentDate = $auctionEndDate->copy()->addDays(7);
            $status = Carbon::now()->gte($paymentDate) ? 'completed' : 'pending';

            $settlements[] = [
                'id' => $row->auction_id,
                'auction' => $auction->title,
                'auction_date' => $auction->event_date->format('Y-m-d'),
                'total_sales' => (float) $row->total_sales,
                'commission' => (float) $row->total_commission,
                'shipping_fee' => 0, // 将来的に配送料を追加
                'packing_fee' => 0, // 将来的に梱包料を追加
                'net_amount' => (float) $row->total_net,
                'status' => $status,
                'paid_at' => $status === 'completed' ? $paymentDate->format('Y-m-d') : null,
                'items_count' => (int) $row->items_count,
            ];
        }

        // 日付で降順ソート
        usort($settlements, fn($a, $b) => strtotime($b['auction_date']) - strtotime($a['auction_date']));

        // 統計を計算
        $completedSettlements = array_filter($settlements, fn($s) => $s['status'] === 'completed');
        $totalNetAmount = array_sum(array_column($completedSettlements, 'net_amount'));
        $totalSales = array_sum(array_column($completedSettlements, 'total_sales'));
        $totalCommission = array_sum(array_column($completedSettlements, 'commission'));
        $completedCount = count($completedSettlements);

        // 月別売上データ（過去6ヶ月）
        $monthlySales = $this->getMonthlySales($sellerProfileId);

        // 銀行口座情報
        $bankInfo = $this->getBankInfo($seller);

        // 次回精算予定
        $nextSettlement = $this->getNextSettlement($sellerProfileId);

        return response()->json([
            'success' => true,
            'data' => [
                'settlements' => $settlements,
                'statistics' => [
                    'total_net_amount' => $totalNetAmount,
                    'total_sales' => $totalSales,
                    'total_commission' => $totalCommission,
                    'completed_count' => $completedCount,
                ],
                'monthly_sales' => $monthlySales,
                'bank_info' => $bankInfo,
                'next_settlement' => $nextSettlement,
            ],
        ]);
    }

    /**
     * 精算詳細取得
     *
     * @param int $auctionId
     * @return \Illuminate\Http\JsonResponse
     */
    public function show($auctionId)
    {
        $sellerProfile = Auth::user()->sellerProfile;
        
        if (!$sellerProfile) {
            return response()->json([
                'success' => false,
                'message' => '出品者プロフィールが見つかりません。',
            ], 404);
        }
        
        $sellerProfileId = $sellerProfile->id;
        $auction = Auction::findOrFail($auctionId);

        // 自分の出品商品の落札情報を取得
        $wonItems = WonItem::whereHas('item', function ($q) use ($sellerProfileId, $auctionId) {
            $q->where('seller_profile_id', $sellerProfileId)->where('auction_id', $auctionId);
        })->with(['item', 'winner'])->get();

        if ($wonItems->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => '精算情報が見つかりません。',
            ], 404);
        }

        $totalSales = $wonItems->sum('total_amount');
        $totalCommission = $wonItems->sum('commission_amount');
        $totalNet = $wonItems->sum('seller_amount');

        // 精算ステータス
        $paymentDate = $auction->event_date->copy()->addDays(7);
        $status = Carbon::now()->gte($paymentDate) ? 'completed' : 'pending';

        return response()->json([
            'success' => true,
            'data' => [
                'settlement' => [
                    'id' => $auctionId,
                    'auction' => $auction->title,
                    'auction_date' => $auction->event_date->format('Y-m-d'),
                    'total_sales' => $totalSales,
                    'commission' => $totalCommission,
                    'shipping_fee' => 0,
                    'packing_fee' => 0,
                    'net_amount' => $totalNet,
                    'status' => $status,
                    'paid_at' => $status === 'completed' ? $paymentDate->format('Y-m-d') : null,
                    'items_count' => $wonItems->count(),
                ],
                'items' => $wonItems->map(function ($wonItem) {
                    return [
                        'id' => $wonItem->id,
                        'item' => [
                            'id' => $wonItem->item->id,
                            'item_number' => $wonItem->item->item_number,
                            'species_name' => $wonItem->item->species_name,
                            'quantity' => $wonItem->item->quantity,
                        ],
                        'buyer' => $wonItem->winner ? $wonItem->winner->name : '不明',
                        'winning_price' => $wonItem->winning_price,
                        'commission' => $wonItem->commission_amount,
                        'seller_amount' => $wonItem->seller_amount,
                    ];
                }),
            ],
        ]);
    }

    /**
     * 月別売上データを取得
     */
    private function getMonthlySales(int $sellerProfileId): array
    {
        $result = [];
        for ($i = 5; $i >= 0; $i--) {
            $month = Carbon::now()->subMonths($i);
            $startOfMonth = $month->copy()->startOfMonth();
            $endOfMonth = $month->copy()->endOfMonth();

            $sales = WonItem::whereHas('item', function ($q) use ($sellerProfileId) {
                $q->where('seller_profile_id', $sellerProfileId);
            })
                ->whereBetween('created_at', [$startOfMonth, $endOfMonth])
                ->selectRaw('SUM(total_amount) as sales, SUM(seller_amount) as net')
                ->first();

            $result[] = [
                'month' => $month->format('n') . '月',
                'sales' => (float) ($sales->sales ?? 0),
                'net' => (float) ($sales->net ?? 0),
            ];
        }
        return $result;
    }

    /**
     * 銀行口座情報を取得
     */
    private function getBankInfo(User $seller): array
    {
        $profile = $seller->sellerProfile;
        
        if (!$profile) {
            return [
                'bank_name' => '未登録',
                'branch_name' => '未登録',
                'account_type' => '普通',
                'account_number' => '未登録',
                'account_holder' => '未登録',
            ];
        }

        // 非公開属性を取得
        $accountType = match ($profile->account_type) {
            'savings' => '普通',
            'checking' => '当座',
            default => $profile->account_type ?? '普通',
        };

        return [
            'bank_name' => $profile->bank_name ?? '未登録',
            'branch_name' => $profile->bank_branch ?? '未登録',
            'account_type' => $accountType,
            'account_number' => $profile->account_number ? '****' . substr($profile->account_number, -4) : '未登録',
            'account_holder' => $profile->account_holder ?? '未登録',
        ];
    }

    /**
     * 次回精算予定を取得
     */
    private function getNextSettlement(int $sellerProfileId): ?array
    {
        // 今後のオークションで出品があるものを探す
        $upcomingAuction = Auction::whereIn('status', ['scheduled', 'live'])
            ->whereHas('items', function ($q) use ($sellerProfileId) {
                $q->where('seller_profile_id', $sellerProfileId);
            })
            ->orderBy('event_date')
            ->first();

        if (!$upcomingAuction) {
            return null;
        }

        $itemsCount = $upcomingAuction->items()->where('seller_profile_id', $sellerProfileId)->count();

        return [
            'auction' => $upcomingAuction->title,
            'auction_date' => $upcomingAuction->event_date->format('Y-m-d'),
            'items_count' => $itemsCount,
            'expected_payment_date' => $upcomingAuction->event_date->copy()->addDays(7)->format('Y-m-d'),
        ];
    }
}
