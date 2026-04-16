<?php

namespace App\Services;

use App\Models\Auction;
use App\Models\WonItem;
use App\Models\User;
use App\Models\UserReview;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ReportService
{
    /**
     * 週次レポートデータを生成
     */
    public function generateWeeklyReport(?Carbon $startDate = null): array
    {
        $start = $startDate ?? now()->startOfWeek();
        $end = $start->copy()->endOfWeek();

        return $this->generateReport($start, $end, 'weekly');
    }

    /**
     * 月次レポートデータを生成
     */
    public function generateMonthlyReport(?Carbon $startDate = null): array
    {
        $start = $startDate ?? now()->startOfMonth();
        $end = $start->copy()->endOfMonth();

        return $this->generateReport($start, $end, 'monthly');
    }

    private function generateReport(Carbon $start, Carbon $end, string $type): array
    {
        // オークション統計
        $auctionStats = Auction::whereBetween('event_date', [$start, $end])
            ->selectRaw("
                COUNT(*) as total_auctions,
                SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) as completed_auctions
            ")
            ->first();

        // 取引統計
        $transactionStats = WonItem::whereBetween('created_at', [$start, $end])
            ->selectRaw("
                COUNT(*) as total_transactions,
                SUM(winning_price) as total_sales,
                AVG(winning_price) as average_price,
                MAX(winning_price) as highest_price,
                MIN(winning_price) as lowest_price
            ")
            ->first();

        // 品種別ランキング
        $speciesRanking = WonItem::join('items', 'won_items.item_id', '=', 'items.id')
            ->whereBetween('won_items.created_at', [$start, $end])
            ->groupBy('items.species_name')
            ->selectRaw('items.species_name, COUNT(*) as count, SUM(won_items.winning_price) as total_amount, AVG(won_items.winning_price) as avg_price')
            ->orderByDesc('count')
            ->limit(10)
            ->get();

        // ユーザー統計
        $userStats = [
            'new_registrations' => User::whereBetween('created_at', [$start, $end])->count(),
            'active_bidders' => DB::table('bid_events')
                ->whereBetween('created_at', [$start, $end])
                ->distinct('user_id')
                ->count('user_id'),
            'active_sellers' => DB::table('items')
                ->whereBetween('created_at', [$start, $end])
                ->distinct('seller_id')
                ->count('seller_id'),
        ];

        // 入金率
        $paymentStats = WonItem::whereBetween('created_at', [$start, $end])
            ->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid
            ")
            ->first();
        $paymentRate = $paymentStats->total > 0
            ? round(($paymentStats->paid / $paymentStats->total) * 100, 1)
            : 0;

        return [
            'report_type' => $type,
            'period' => [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
            ],
            'generated_at' => now()->toIso8601String(),
            'auction_summary' => [
                'total_auctions' => (int) $auctionStats->total_auctions,
                'completed_auctions' => (int) $auctionStats->completed_auctions,
            ],
            'transaction_summary' => [
                'total_transactions' => (int) $transactionStats->total_transactions,
                'total_sales' => (int) ($transactionStats->total_sales ?? 0),
                'average_price' => (int) ($transactionStats->average_price ?? 0),
                'highest_price' => (int) ($transactionStats->highest_price ?? 0),
                'lowest_price' => (int) ($transactionStats->lowest_price ?? 0),
            ],
            'species_ranking' => $speciesRanking,
            'user_stats' => $userStats,
            'payment_rate' => $paymentRate,
        ];
    }
}
