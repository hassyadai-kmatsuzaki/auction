<?php

namespace App\Services\AI;

use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * AI 機能（価格予測・レコメンド・マッチング・不正検知）とレポートで共通の「集計から外すデータ」。
 * - 下支え入札アカウント（services.ai.house_buyer_ids。既定 821）
 * - 練習・運用テストの開催（services.ai.excluded_auction_ids）
 * - テスト開催（auctions.is_test）とテストユーザー（users.is_test）
 */
class AiDataScope
{
    /** @return int[] */
    public static function houseBuyerIds(): array
    {
        return array_map('intval', (array) config('services.ai.house_buyer_ids', []));
    }

    /** @return int[] */
    public static function excludedAuctionIds(): array
    {
        return array_map('intval', (array) config('services.ai.excluded_auction_ids', []));
    }

    /**
     * 開催で絞る: テスト開催と除外指定の開催を外す
     */
    public static function realAuctions(EloquentBuilder|QueryBuilder $query, string $auctionIdColumn, bool $includeExcluded = false): EloquentBuilder|QueryBuilder
    {
        if (!$includeExcluded) {
            $query->whereNotIn($auctionIdColumn, self::excludedAuctionIds() ?: [0]);
        }

        return $query->whereNotExists(fn ($q) => $q->selectRaw('1')->from('auctions as ads_a')
            ->whereColumn('ads_a.id', $auctionIdColumn)
            ->where('ads_a.is_test', true));
    }

    /**
     * 会員で絞る: 下支えアカウントとテストユーザーを外す
     */
    public static function realUsers(EloquentBuilder|QueryBuilder $query, string $userIdColumn): EloquentBuilder|QueryBuilder
    {
        return $query->whereNotIn($userIdColumn, self::houseBuyerIds() ?: [0])
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('users as ads_u')
                ->whereColumn('ads_u.id', $userIdColumn)
                ->where('ads_u.is_test', true));
    }

    /**
     * won_items × items の集計を実取引だけにする（テスト・除外開催、下支え・テスト会員の落札を外す）
     */
    public static function realWonItems(EloquentBuilder|QueryBuilder $query, string $wonItems = 'won_items', string $items = 'items', bool $includeExcluded = false): EloquentBuilder|QueryBuilder
    {
        self::realAuctions($query, "{$items}.auction_id", $includeExcluded);

        return self::realUsers($query, "{$wonItems}.winner_id");
    }
}
