<?php

namespace App\Services\AI;

use App\Models\AIFraudAlert;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class FraudDetectionService
{
    /**
     * オークションの入札パターンを分析して不正を検知
     */
    public function analyzeAuction(int $auctionId): array
    {
        $alerts = [];

        $alerts = array_merge($alerts, $this->detectShillBidding($auctionId));
        $alerts = array_merge($alerts, $this->detectBidPatternAnomalies($auctionId));
        $alerts = array_merge($alerts, $this->detectPriceManipulation($auctionId));

        return $alerts;
    }

    /**
     * user_id が users テーブルに存在するか確認し、なければ null を返す
     * （ソフトデリート済み・物理削除済みユーザーでFK制約違反を防ぐ）
     */
    private function resolveUserId(?int $userId): ?int
    {
        if ($userId === null) {
            return null;
        }
        return User::where('id', $userId)->exists() ? $userId : null;
    }

    /**
     * サクラ入札（吊り上げ入札）の検知
     */
    private function detectShillBidding(int $auctionId): array
    {
        $alerts = [];

        $suspiciousPatterns = DB::table('bid_events as be')
            ->join('items as i', 'be.item_id', '=', 'i.id')
            ->where('i.auction_id', $auctionId)
            ->where('be.event_type', 'leave')
            ->groupBy('be.user_id', 'i.seller_profile_id')
            ->selectRaw('be.user_id, i.seller_profile_id, COUNT(*) as leave_count')
            ->having('leave_count', '>=', 3)
            ->get();

        foreach ($suspiciousPatterns as $pattern) {
            $wonCount = DB::table('won_items')
                ->join('items', 'won_items.item_id', '=', 'items.id')
                ->where('won_items.winner_id', $pattern->user_id)
                ->where('items.seller_profile_id', $pattern->seller_profile_id)
                ->count();

            if ($wonCount === 0 && $pattern->leave_count >= 3) {
                $alert = AIFraudAlert::create([
                    'auction_id' => $auctionId,
                    'user_id' => $this->resolveUserId($pattern->user_id),
                    'alert_type' => 'shill_bidding',
                    'severity' => $pattern->leave_count >= 5 ? 'high' : 'medium',
                    'description' => "ユーザーID:{$pattern->user_id}が出品者ID:{$pattern->seller_profile_id}の商品で{$pattern->leave_count}回入札後離脱（落札0件）",
                    'evidence' => [
                        'user_id' => $pattern->user_id,
                        'seller_profile_id' => $pattern->seller_profile_id,
                        'leave_count' => $pattern->leave_count,
                        'won_count' => $wonCount,
                    ],
                ]);
                $alerts[] = $alert;
            }
        }

        return $alerts;
    }

    /**
     * 入札パターンの異常検知
     */
    private function detectBidPatternAnomalies(int $auctionId): array
    {
        $alerts = [];

        $rapidBidders = DB::table('bid_events as be1')
            ->join('bid_events as be2', function ($join) {
                $join->on('be1.user_id', '=', 'be2.user_id')
                    ->on('be1.id', '<', 'be2.id')
                    ->whereRaw('TIMESTAMPDIFF(SECOND, be1.created_at, be2.created_at) <= 1');
            })
            ->join('items as i', 'be1.item_id', '=', 'i.id')
            ->where('i.auction_id', $auctionId)
            ->where('be1.event_type', 'join')
            ->groupBy('be1.user_id')
            ->selectRaw('be1.user_id, COUNT(*) as rapid_count')
            ->having('rapid_count', '>=', 5)
            ->get();

        foreach ($rapidBidders as $bidder) {
            $alert = AIFraudAlert::create([
                'auction_id' => $auctionId,
                'user_id' => $this->resolveUserId($bidder->user_id),
                'alert_type' => 'bid_pattern',
                'severity' => 'medium',
                'description' => "ユーザーID:{$bidder->user_id}が異常な速度で入札（1秒以内に{$bidder->rapid_count}回の連続入札）",
                'evidence' => [
                    'user_id' => $bidder->user_id,
                    'rapid_bid_count' => $bidder->rapid_count,
                ],
            ]);
            $alerts[] = $alert;
        }

        return $alerts;
    }

    /**
     * 価格操作の検知
     */
    private function detectPriceManipulation(int $auctionId): array
    {
        $alerts = [];

        $wonItems = DB::table('won_items')
            ->join('items', 'won_items.item_id', '=', 'items.id')
            ->where('items.auction_id', $auctionId)
            ->select('won_items.*', 'items.species_name', 'items.seller_profile_id')
            ->get();

        foreach ($wonItems as $won) {
            $avgPrice = DB::table('won_items')
                ->join('items', 'won_items.item_id', '=', 'items.id')
                ->where('items.species_name', $won->species_name)
                ->where('items.auction_id', '!=', $auctionId)
                ->where('won_items.payment_status', 'paid')
                ->avg('won_items.winning_price');

            if ($avgPrice && $won->winning_price > $avgPrice * 3) {
                $alert = AIFraudAlert::create([
                    'auction_id' => $auctionId,
                    'user_id' => $this->resolveUserId($won->winner_id),
                    'alert_type' => 'price_manipulation',
                    'severity' => 'high',
                    'description' => "{$won->species_name}の落札価格({$won->winning_price}円)が平均(" . round($avgPrice) . "円)の3倍以上",
                    'evidence' => [
                        'winning_price' => $won->winning_price,
                        'average_price' => round($avgPrice),
                        'ratio' => round($won->winning_price / $avgPrice, 2),
                        'species' => $won->species_name,
                    ],
                ]);
                $alerts[] = $alert;
            }
        }

        return $alerts;
    }

    /**
     * アラート一覧取得
     */
    public function getAlerts(array $filters = []): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $query = AIFraudAlert::with(['auction:id,title', 'user:id,name,email']);

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (!empty($filters['severity'])) {
            $query->where('severity', $filters['severity']);
        }

        return $query->orderByDesc('created_at')->paginate(20);
    }
}
