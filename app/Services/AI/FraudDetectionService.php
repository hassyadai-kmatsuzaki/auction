<?php

namespace App\Services\AI;

use App\Models\AIFraudAlert;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class FraudDetectionService
{
    /**
     * 集計対象とする入金済みステータス（入金確認後は paid → confirmed に進む）
     */
    private const SETTLED_PAYMENT_STATUSES = ['paid', 'confirmed'];

    /**
     * 指値からの自動入札の join に入る user_agent（SetBidLimitAction が記録）
     */
    private const AUTO_BID_USER_AGENT = 'auto-bid-from-limit';

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
     * 検知対象外の会員（下支えアカウント・テストユーザー）を返す
     *
     * @param int[] $userIds
     * @return int[]
     */
    private function excludedUserIds(array $userIds): array
    {
        $house = AiDataScope::houseBuyerIds();
        $tests = User::whereIn('id', $userIds)->where('is_test', true)->pluck('id')->map(fn ($id) => (int) $id)->all();

        return array_values(array_unique(array_merge(array_intersect($userIds, $house), $tests)));
    }

    /**
     * 同一オークション・同一種別・同一内容のアラートが既にあれば作成しない（検知の再実行で重複させない）。
     * 新規作成した場合のみアラートを返す。
     */
    private function createAlertOnce(array $attributes): ?AIFraudAlert
    {
        $alert = AIFraudAlert::firstOrCreate(
            [
                'auction_id' => $attributes['auction_id'],
                'alert_type' => $attributes['alert_type'],
                'description' => $attributes['description'],
            ],
            $attributes,
        );

        return $alert->wasRecentlyCreated ? $alert : null;
    }

    /**
     * サクラ入札（吊り上げ入札）の検知
     *
     * 本システムには自分から入札をやめる操作が無く、leave は指値到達による自動離脱のみ。
     * そのため「離脱回数」ではなく、「売れた商品で最後まで競り合った（最後に離脱した）のに落札しない」
     * が同じ出品者に偏っているかで判定する。
     * 条件: 同一出品者の商品で最後まで競り合った件数が3件以上・その出品者からの落札が過去0件・
     *       その開催で入札した商品の半分以上がその出品者。下支えアカウントとテストユーザーは対象外。
     */
    private function detectShillBidding(int $auctionId): array
    {
        $alerts = [];

        // 売れた商品ごとに「落札者以外で最後に離脱した会員」（＝最後まで競り合った相手）を求める
        $runnerUps = [];
        $soldItems = DB::table('won_items')
            ->join('items', 'won_items.item_id', '=', 'items.id')
            ->where('items.auction_id', $auctionId)
            ->get(['items.id as item_id', 'items.seller_profile_id', 'won_items.winner_id']);

        foreach ($soldItems as $sold) {
            $last = DB::table('bid_events')
                ->where('item_id', $sold->item_id)
                ->where('event_type', 'leave')
                ->where('user_id', '!=', $sold->winner_id)
                ->orderByDesc('id')
                ->value('user_id');
            if ($last !== null) {
                $runnerUps[(int) $last][(int) $sold->seller_profile_id][] = (int) $sold->item_id;
            }
        }
        if (!$runnerUps) {
            return [];
        }

        $excluded = $this->excludedUserIds(array_keys($runnerUps));

        foreach ($runnerUps as $userId => $bySeller) {
            if (in_array($userId, $excluded, true)) {
                continue;
            }
            $joinedItems = DB::table('bid_events')
                ->join('items', 'bid_events.item_id', '=', 'items.id')
                ->where('items.auction_id', $auctionId)
                ->where('bid_events.user_id', $userId)
                ->where('bid_events.event_type', 'join')
                ->distinct()
                ->pluck('items.seller_profile_id', 'items.id');
            $joinedTotal = max(1, $joinedItems->count());

            foreach ($bySeller as $sellerProfileId => $itemIds) {
                $runnerUpCount = count($itemIds);
                if ($runnerUpCount < 3) {
                    continue;
                }
                $sellerShare = $joinedItems->filter(fn ($s) => (int) $s === $sellerProfileId)->count() / $joinedTotal;
                if ($sellerShare < 0.5) {
                    continue;
                }
                $wonCount = DB::table('won_items')
                    ->join('items', 'won_items.item_id', '=', 'items.id')
                    ->where('won_items.winner_id', $userId)
                    ->where('items.seller_profile_id', $sellerProfileId)
                    ->count();
                if ($wonCount > 0) {
                    continue;
                }

                $alert = $this->createAlertOnce([
                    'auction_id' => $auctionId,
                    'user_id' => $this->resolveUserId($userId),
                    'alert_type' => 'shill_bidding',
                    'severity' => $runnerUpCount >= 5 ? 'high' : 'medium',
                    'description' => "ユーザーID:{$userId}が出品者ID:{$sellerProfileId}の商品{$runnerUpCount}件で最後まで競り合い落札せず（同出品者からの落札0件）",
                    'evidence' => [
                        'user_id' => $userId,
                        'seller_profile_id' => $sellerProfileId,
                        'runner_up_count' => $runnerUpCount,
                        'runner_up_item_ids' => $itemIds,
                        'seller_share' => round($sellerShare, 2),
                        'won_count' => $wonCount,
                    ],
                ]);
                if ($alert) {
                    $alerts[] = $alert;
                }
            }
        }

        return $alerts;
    }

    /**
     * 入札パターンの異常検知
     *
     * 本人が押した入札（指値からの自動入札は除く）で、直前の入札から1秒以内の連続が5回以上ある会員。
     * 同一開催内の隣り合う入札だけを比べる（DB 依存の日時関数は使わない）
     */
    private function detectBidPatternAnomalies(int $auctionId): array
    {
        $alerts = [];

        $joins = DB::table('bid_events')
            ->join('items', 'bid_events.item_id', '=', 'items.id')
            ->where('items.auction_id', $auctionId)
            ->where('bid_events.event_type', 'join')
            ->where(fn ($q) => $q->whereNull('bid_events.user_agent')
                ->orWhere('bid_events.user_agent', '!=', self::AUTO_BID_USER_AGENT))
            ->orderBy('bid_events.user_id')
            ->orderBy('bid_events.created_at')
            ->orderBy('bid_events.id')
            ->get(['bid_events.user_id', 'bid_events.created_at']);

        $rapid = [];
        $prev = [];
        foreach ($joins as $join) {
            $userId = (int) $join->user_id;
            $at = strtotime((string) $join->created_at);
            if (isset($prev[$userId]) && $at - $prev[$userId] <= 1) {
                $rapid[$userId] = ($rapid[$userId] ?? 0) + 1;
            }
            $prev[$userId] = $at;
        }
        $rapid = array_filter($rapid, fn ($count) => $count >= 5);
        if (!$rapid) {
            return [];
        }

        $excluded = $this->excludedUserIds(array_keys($rapid));

        foreach ($rapid as $userId => $rapidCount) {
            if (in_array($userId, $excluded, true)) {
                continue;
            }
            $alert = $this->createAlertOnce([
                'auction_id' => $auctionId,
                'user_id' => $this->resolveUserId($userId),
                'alert_type' => 'bid_pattern',
                'severity' => 'medium',
                'description' => "ユーザーID:{$userId}が異常な速度で入札（直前の入札から1秒以内の入札が{$rapidCount}回）",
                'evidence' => [
                    'user_id' => $userId,
                    'rapid_bid_count' => $rapidCount,
                ],
            ]);
            if ($alert) {
                $alerts[] = $alert;
            }
        }

        return $alerts;
    }

    /**
     * 価格操作の検知
     * 基準の平均は実取引のみ（テスト・除外開催、下支え・テスト会員の落札を除く）。単価同士で比べる
     */
    private function detectPriceManipulation(int $auctionId): array
    {
        $alerts = [];

        $wonItems = AiDataScope::realUsers(
            DB::table('won_items')
                ->join('items', 'won_items.item_id', '=', 'items.id')
                ->where('items.auction_id', $auctionId),
            'won_items.winner_id',
        )
            ->select('won_items.*', 'items.species_name', 'items.seller_profile_id')
            ->get();

        foreach ($wonItems as $won) {
            $avgPrice = AiDataScope::realWonItems(
                DB::table('won_items')
                    ->join('items', 'won_items.item_id', '=', 'items.id')
                    ->where('items.species_name', $won->species_name)
                    ->where('items.auction_id', '!=', $auctionId)
                    ->whereIn('won_items.payment_status', self::SETTLED_PAYMENT_STATUSES),
            )->avg('won_items.winning_price');

            if ($avgPrice && $won->winning_price > $avgPrice * 3) {
                $alert = $this->createAlertOnce([
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
                if ($alert) {
                    $alerts[] = $alert;
                }
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
