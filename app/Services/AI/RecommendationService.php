<?php

namespace App\Services\AI;

use App\Models\AIRecommendation;
use App\Models\Item;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class RecommendationService
{
    /**
     * ユーザーに対する商品レコメンドを生成
     */
    public function generateRecommendations(User $user, int $limit = 20): array
    {
        $recommendations = [];

        // 1. 協調フィルタリング（同じ品種を落札した他ユーザーの行動から）
        $collaborative = $this->collaborativeFiltering($user, $limit);
        foreach ($collaborative as $rec) {
            $recommendations[$rec['item_id']] = $rec;
        }

        // 2. コンテンツベース（ユーザーの過去の入札・お気に入り品種から）
        $contentBased = $this->contentBasedFiltering($user, $limit);
        foreach ($contentBased as $rec) {
            if (isset($recommendations[$rec['item_id']])) {
                // スコア統合
                $recommendations[$rec['item_id']]['score'] = ($recommendations[$rec['item_id']]['score'] + $rec['score']) / 2;
                $recommendations[$rec['item_id']]['source'] = 'hybrid';
            } else {
                $recommendations[$rec['item_id']] = $rec;
            }
        }

        // 3. トレンド（直近の人気商品）
        $trending = $this->getTrending($user, $limit);
        foreach ($trending as $rec) {
            if (!isset($recommendations[$rec['item_id']])) {
                $recommendations[$rec['item_id']] = $rec;
            }
        }

        // スコア順にソートして保存
        usort($recommendations, fn($a, $b) => $b['score'] <=> $a['score']);
        $recommendations = array_slice($recommendations, 0, $limit);

        // DB保存（FK制約違反を防ぐため、存在しないitem_idはスキップ）
        $existingItemIds = Item::whereIn('id', array_column($recommendations, 'item_id'))
            ->pluck('id')
            ->toArray();

        foreach ($recommendations as $rec) {
            if (!in_array($rec['item_id'], $existingItemIds)) {
                continue;
            }
            AIRecommendation::updateOrCreate(
                ['user_id' => $user->id, 'item_id' => $rec['item_id']],
                [
                    'score' => $rec['score'],
                    'reason' => $rec['reason'],
                    'source' => $rec['source'],
                ],
            );
        }

        return $recommendations;
    }

    /**
     * 協調フィルタリング
     */
    private function collaborativeFiltering(User $user, int $limit): array
    {
        // ユーザーが過去に落札した品種
        $userSpecies = DB::table('won_items')
            ->join('items', 'won_items.item_id', '=', 'items.id')
            ->where('won_items.winner_id', $user->id)
            ->pluck('items.species_name')
            ->unique()
            ->toArray();

        if (empty($userSpecies)) {
            return [];
        }

        // 同じ品種を落札した他のユーザーが落札した別の品種
        $similarUserItems = DB::table('won_items as wi1')
            ->join('items as i1', 'wi1.item_id', '=', 'i1.id')
            ->join('won_items as wi2', 'wi1.winner_id', '=', 'wi2.winner_id')
            ->join('items as i2', 'wi2.item_id', '=', 'i2.id')
            ->whereIn('i1.species_name', $userSpecies)
            ->where('wi2.winner_id', '!=', $user->id)
            ->whereNotIn('i2.species_name', $userSpecies)
            ->groupBy('i2.species_name')
            ->selectRaw('i2.species_name, COUNT(DISTINCT wi1.winner_id) as co_occurrence')
            ->orderByDesc('co_occurrence')
            ->limit(10)
            ->get();

        // 推薦品種の出品中商品を取得
        $recommendations = [];
        foreach ($similarUserItems as $species) {
            $items = Item::where('species_name', $species->species_name)
                ->where('status', 'registered')
                ->limit(3)
                ->get();

            foreach ($items as $item) {
                $recommendations[] = [
                    'item_id' => $item->id,
                    'score' => min(1.0, $species->co_occurrence * 0.15),
                    'reason' => "同じ品種を落札した他のユーザーに人気の品種: {$species->species_name}",
                    'source' => 'collaborative',
                ];
            }
        }

        return $recommendations;
    }

    /**
     * コンテンツベースフィルタリング
     */
    private function contentBasedFiltering(User $user, int $limit): array
    {
        // お気に入り・入札履歴から好みの品種を特定
        $favoriteSpecies = DB::table('favorites')
            ->join('items', 'favorites.item_id', '=', 'items.id')
            ->where('favorites.user_id', $user->id)
            ->groupBy('items.species_name')
            ->selectRaw('items.species_name, COUNT(*) as fav_count')
            ->orderByDesc('fav_count')
            ->limit(5)
            ->pluck('fav_count', 'species_name');

        $recommendations = [];
        foreach ($favoriteSpecies as $species => $count) {
            $items = Item::where('species_name', $species)
                ->where('status', 'registered')
                ->whereNotIn('id', function ($q) use ($user) {
                    $q->select('item_id')->from('favorites')->where('user_id', $user->id);
                })
                ->limit(3)
                ->get();

            foreach ($items as $item) {
                $recommendations[] = [
                    'item_id' => $item->id,
                    'score' => min(1.0, $count * 0.2),
                    'reason' => "お気に入りの品種: {$species}",
                    'source' => 'content_based',
                ];
            }
        }

        return $recommendations;
    }

    /**
     * トレンド（直近の人気商品）
     */
    private function getTrending(User $user, int $limit): array
    {
        $trendingItems = DB::table('favorites')
            ->join('items', 'favorites.item_id', '=', 'items.id')
            ->where('items.status', 'registered')
            ->where('favorites.created_at', '>=', now()->subDays(7))
            ->groupBy('items.id', 'items.species_name')
            ->selectRaw('items.id as item_id, items.species_name, COUNT(*) as fav_count')
            ->orderByDesc('fav_count')
            ->limit($limit)
            ->get();

        return $trendingItems->map(fn($item) => [
            'item_id' => $item->item_id,
            'score' => min(1.0, $item->fav_count * 0.1),
            'reason' => "今週の人気商品: {$item->species_name}（{$item->fav_count}件のお気に入り）",
            'source' => 'trending',
        ])->toArray();
    }

    /**
     * ユーザーのレコメンド一覧を取得
     */
    public function getForUser(int $userId, int $limit = 20): \Illuminate\Support\Collection
    {
        return AIRecommendation::where('user_id', $userId)
            ->with(['item.media'])
            ->orderByDesc('score')
            ->limit($limit)
            ->get();
    }
}
