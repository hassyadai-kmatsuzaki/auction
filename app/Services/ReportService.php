<?php

namespace App\Services;

use App\Models\Auction;
use App\Models\WonItem;
use App\Models\User;
use App\Models\UserReview;
use App\Services\AI\AiDataScope;
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

        // 取引統計（実取引のみ: テスト開催・下支えアカウント・テストユーザーの落札は除く）
        // 売上は 落札単価×数量（税抜）。平均・最高・最低は落札単価
        $transactionStats = $this->realWonItems($start, $end)
            ->selectRaw("
                COUNT(*) as total_transactions,
                SUM(won_items.winning_price * won_items.quantity) as total_sales,
                AVG(won_items.winning_price) as average_price,
                MAX(won_items.winning_price) as highest_price,
                MIN(won_items.winning_price) as lowest_price
            ")
            ->first();

        // 品種別ランキング
        $speciesRanking = $this->realWonItems($start, $end)
            ->groupBy('items.species_name')
            ->selectRaw('items.species_name, COUNT(*) as count, SUM(won_items.winning_price * won_items.quantity) as total_amount, AVG(won_items.winning_price) as avg_price')
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
                ->distinct('seller_profile_id')
                ->count('seller_profile_id'),
        ];

        // 入金率（入金確認後は paid → confirmed に進むので両方を入金済みとして数える）
        $paymentStats = $this->realWonItems($start, $end)
            ->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN won_items.payment_status IN ('paid', 'confirmed') THEN 1 ELSE 0 END) as paid
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

    /**
     * 期間内の実取引の落札（won_items × items）。AI 学習用の除外開催指定は売上集計には適用しない
     */
    private function realWonItems(Carbon $start, Carbon $end): \Illuminate\Database\Eloquent\Builder
    {
        return AiDataScope::realWonItems(
            WonItem::query()
                ->join('items', 'won_items.item_id', '=', 'items.id')
                ->whereBetween('won_items.created_at', [$start, $end]),
            includeExcluded: true,
        );
    }
}
