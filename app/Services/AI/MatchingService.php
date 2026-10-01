<?php

namespace App\Services\AI;

use App\Models\Item;
use App\Models\User;
use App\Services\AI\ML\PriceFeatureEncoder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * マッチングシステム（F-059・基本版）: 購買履歴と出品パターンの分析
 *
 * 買受者ごとに「どの品種・どの出品者・どの価格帯を好むか」を過去の行動から数値化し（購買プロファイル）、
 * 出品物の特徴（品種・出品者・想定価格）と照らし合わせて相性の点数を出す。
 *
 * 行動の重み: 落札 3 / 指値 2 / 入札参加 1 / お気に入り 1
 * 点数 = 品種の相性 45% + 出品者の相性 25% + 価格帯の近さ 20% + 最近の活動 10%
 * 終了済み・テスト以外の開催の行動だけを使い、テストユーザーと自社の下支え入札アカウントは除外する。
 */
class MatchingService
{
    private const WEIGHTS = ['win' => 3.0, 'limit' => 2.0, 'bid' => 1.0, 'favorite' => 1.0];

    private const SCORE_WEIGHTS = ['species' => 0.45, 'seller' => 0.25, 'price' => 0.20, 'recency' => 0.10];

    private const CACHE_TTL_SECONDS = 1800;

    /** これ未満の落札しかない開催は、練習・デモとみなして検証に使わない */
    private const MIN_AUCTION_SAMPLES = 10;

    /**
     * 出品物に対して相性の良い買受者を返す
     *
     * @return array<int, array{user_id: int, name: string, score: float, reasons: string[], wins: int, breakdown: array}>
     */
    public function matchBuyersForItem(Item $item, int $limit = 10, ?Carbon $before = null, ?float $expectedPrice = null): array
    {
        $profiles = $this->buyerProfiles($before);
        $species = PriceFeatureEncoder::normalizeSpecies((string) $item->species_name);
        $keywords = $this->keywords($species);
        $expected = $expectedPrice ?? (float) $item->start_price;
        $referenceDate = $before ?? now();

        $scored = [];
        foreach ($profiles as $userId => $p) {
            $breakdown = $this->scoreProfile($p, $species, $keywords, (int) $item->seller_profile_id, $expected, $referenceDate);
            if ($breakdown['species'] <= 0 && $breakdown['seller'] <= 0) {
                continue; // 品種にも出品者にも接点が無い人は候補にしない
            }
            $score = 0.0;
            foreach (self::SCORE_WEIGHTS as $k => $w) {
                $score += $w * $breakdown[$k];
            }
            $scored[] = ['user_id' => $userId, 'score' => round($score * 100, 1), 'breakdown' => $breakdown, 'profile' => $p];
        }

        usort($scored, fn ($a, $b) => $b['score'] <=> $a['score'] ?: $a['user_id'] <=> $b['user_id']);
        $scored = array_slice($scored, 0, $limit);

        $names = User::whereIn('id', array_column($scored, 'user_id'))->get(['id', 'name', 'trade_name'])->keyBy('id');

        return array_map(function ($row) use ($names, $species) {
            $user = $names->get($row['user_id']);
            return [
                'user_id' => $row['user_id'],
                'name' => (string) ($user?->trade_name ?: $user?->name ?: "ID:{$row['user_id']}"),
                'score' => $row['score'],
                'reasons' => $this->reasons($row['profile'], $row['breakdown'], $species),
                'wins' => $row['profile']['wins'],
                'breakdown' => array_map(fn ($v) => round($v, 3), $row['breakdown']),
            ];
        }, $scored);
    }

    /**
     * 買受者から見た出品物の相性（レコメンドの「マッチング」に使う）
     *
     * @param  iterable<Item>  $items
     * @return array<int, array{item_id: int, score: float, reason: string}>
     */
    public function scoreItemsForBuyer(int $userId, iterable $items): array
    {
        $profile = $this->buyerProfiles()[$userId] ?? null;
        if (!$profile) {
            return [];
        }

        $results = [];
        foreach ($items as $item) {
            $species = PriceFeatureEncoder::normalizeSpecies((string) $item->species_name);
            $breakdown = $this->scoreProfile($profile, $species, $this->keywords($species), (int) $item->seller_profile_id, (float) $item->start_price, now());
            if ($breakdown['species'] <= 0 && $breakdown['seller'] <= 0) {
                continue;
            }
            $score = 0.0;
            foreach (self::SCORE_WEIGHTS as $k => $w) {
                $score += $w * $breakdown[$k];
            }
            $results[] = [
                'item_id' => $item->id,
                'score' => round(min(1.0, $score), 4),
                'reason' => 'マッチング: ' . implode('・', array_slice($this->reasons($profile, $breakdown, $species), 0, 2)),
            ];
        }

        return $results;
    }

    /**
     * 過去の開催で「実際の落札者が上位10人に入ったか」を検証する（予測力の確認）
     *
     * @return array{auctions: int, items: int, hit_rate_at_10: float, baseline_hit_rate_at_10: float, coverage: float}
     */
    public function evaluate(int $recentAuctions = 3, int $k = 10): array
    {
        $house = $this->houseBuyerIds();
        $candidates = DB::table('auctions')
            ->where('status', 'finished')->where('is_test', false)
            ->whereNotIn('id', array_map('intval', (array) config('services.ai.excluded_auction_ids', [])) ?: [0])
            ->orderByDesc('event_date')->orderByDesc('id')
            ->get(['id', 'event_date']);

        $evaluated = 0;
        $items = 0;
        $hits = 0;
        $baselineHits = 0;
        $covered = 0;

        foreach ($candidates as $auction) {
            if ($evaluated >= $recentAuctions) {
                break;
            }
            $sold = Item::query()
                ->join('won_items', 'won_items.item_id', '=', 'items.id')
                ->join('users as wu', 'wu.id', '=', 'won_items.winner_id')
                ->where('items.auction_id', $auction->id)
                ->where('wu.is_test', false)
                ->whereNotIn('won_items.winner_id', $house ?: [0])
                ->get(['items.*', 'won_items.winner_id']);
            if ($sold->count() < self::MIN_AUCTION_SAMPLES) {
                continue; // 練習・デモ規模の開催は検証に使わない
            }

            $before = Carbon::parse($auction->event_date)->startOfDay();
            $profiles = $this->buyerProfiles($before);
            if (!$profiles) {
                continue;
            }
            $evaluated++;
            // 比較用: 品種を見ずに「過去に一番よく落札している人」上位 k 人
            $popular = collect($profiles)->sortByDesc('activity')->keys()->take($k)->all();

            foreach ($sold as $item) {
                $items++;
                if (isset($profiles[$item->winner_id])) {
                    $covered++;
                }
                $top = array_column($this->matchBuyersForItem($item, $k, $before), 'user_id');
                if (in_array($item->winner_id, $top, true)) {
                    $hits++;
                }
                if (in_array($item->winner_id, $popular, true)) {
                    $baselineHits++;
                }
            }
        }

        return [
            'auctions' => $evaluated,
            'items' => $items,
            'hit_rate_at_10' => $items ? round($hits / $items * 100, 1) : 0.0,
            'baseline_hit_rate_at_10' => $items ? round($baselineHits / $items * 100, 1) : 0.0,
            'coverage' => $items ? round($covered / $items * 100, 1) : 0.0,
        ];
    }

    /**
     * 買受者ごとの購買プロファイル
     *
     * @return array<int, array{species: array<string, float>, keywords: array<string, float>, sellers: array<int, float>, log_prices: float[], median_log_price: ?float, last_at: ?string, wins: int, activity: float}>
     */
    public function buyerProfiles(?Carbon $before = null): array
    {
        $key = 'ai:matching:profiles:v1:' . ($before?->toDateString() ?? 'now');

        return Cache::remember($key, self::CACHE_TTL_SECONDS, function () use ($before) {
            $profiles = [];
            $add = function (int $userId, ?string $species, ?int $sellerId, float $weight, ?string $at, ?float $price = null) use (&$profiles) {
                $p = &$profiles[$userId];
                $p ??= ['species' => [], 'keywords' => [], 'sellers' => [], 'log_prices' => [], 'median_log_price' => null, 'last_at' => null, 'wins' => 0, 'activity' => 0.0];
                $norm = PriceFeatureEncoder::normalizeSpecies((string) $species);
                if ($norm !== '') {
                    $p['species'][$norm] = ($p['species'][$norm] ?? 0) + $weight;
                    foreach ($this->keywords($norm) as $kw) {
                        $p['keywords'][$kw] = ($p['keywords'][$kw] ?? 0) + $weight;
                    }
                }
                if ($sellerId) {
                    $p['sellers'][$sellerId] = ($p['sellers'][$sellerId] ?? 0) + $weight;
                }
                if ($price !== null && $price > 0) {
                    $p['log_prices'][] = log($price);
                }
                if ($at && ($p['last_at'] === null || $at > $p['last_at'])) {
                    $p['last_at'] = $at;
                }
                $p['activity'] += $weight;
            };

            foreach ($this->events('win', $before) as $r) {
                $add((int) $r->user_id, $r->species_name, (int) $r->seller_profile_id, self::WEIGHTS['win'] * $r->cnt, $r->last_at, (float) $r->price);
                $profiles[(int) $r->user_id]['wins'] += (int) $r->cnt;
            }
            foreach ($this->events('limit', $before) as $r) {
                $add((int) $r->user_id, $r->species_name, (int) $r->seller_profile_id, self::WEIGHTS['limit'] * $r->cnt, $r->last_at, (float) $r->price);
            }
            foreach ($this->events('bid', $before) as $r) {
                $add((int) $r->user_id, $r->species_name, (int) $r->seller_profile_id, self::WEIGHTS['bid'] * $r->cnt, $r->last_at);
            }
            foreach ($this->events('favorite', $before) as $r) {
                $add((int) $r->user_id, $r->species_name, (int) $r->seller_profile_id, self::WEIGHTS['favorite'] * $r->cnt, $r->last_at);
            }

            foreach ($profiles as &$p) {
                if ($p['log_prices']) {
                    sort($p['log_prices']);
                    $p['median_log_price'] = $p['log_prices'][intdiv(count($p['log_prices']), 2)];
                }
            }

            return $profiles;
        });
    }

    /**
     * 行動を「利用者×品種×出品者」単位で集計して読む（終了済み・テスト以外の開催、テストユーザー・自社アカウント除外）
     */
    private function events(string $type, ?Carbon $before): \Illuminate\Support\Collection
    {
        [$table, $userCol, $timeCol, $priceExpr] = match ($type) {
            'win' => ['won_items', 'winner_id', 'created_at', 'AVG(e.winning_price)'],
            'limit' => ['bid_limit_prices', 'user_id', 'created_at', 'AVG(e.limit_price)'],
            'bid' => ['bid_events', 'user_id', 'created_at', 'NULL'],
            'favorite' => ['favorites', 'user_id', 'created_at', 'NULL'],
        };

        $query = DB::table("{$table} as e")
            ->join('items as i', 'i.id', '=', 'e.item_id')
            ->join('auctions as a', 'a.id', '=', 'i.auction_id')
            ->join('users as u', 'u.id', "=", "e.{$userCol}")
            ->where('a.status', 'finished')
            ->where('a.is_test', false)
            ->whereNotIn('a.id', array_map('intval', (array) config('services.ai.excluded_auction_ids', [])) ?: [0])
            ->where('u.is_test', false)
            ->whereNotIn("e.{$userCol}", $this->houseBuyerIds() ?: [0])
            ->when($type === 'bid', fn ($q) => $q->where('e.event_type', 'join'))
            ->when($before, fn ($q) => $q->where('a.event_date', '<', $before))
            ->groupBy("e.{$userCol}", 'i.species_name', 'i.seller_profile_id')
            ->selectRaw("e.{$userCol} as user_id, i.species_name, i.seller_profile_id, COUNT(*) as cnt, MAX(e.{$timeCol}) as last_at, {$priceExpr} as price");

        return $query->get();
    }

    /**
     * @return array{species: float, seller: float, price: float, recency: float} それぞれ 0〜1
     */
    private function scoreProfile(array $p, string $species, array $keywords, int $sellerId, float $expectedPrice, Carbon $referenceDate): array
    {
        $maxSpecies = $p['species'] ? max($p['species']) : 0;
        $exact = $maxSpecies > 0 ? ($p['species'][$species] ?? 0) / $maxSpecies : 0.0;
        $kwScore = 0.0;
        if ($keywords && $p['keywords']) {
            $maxKw = max($p['keywords']);
            $kwScore = array_sum(array_map(fn ($kw) => ($p['keywords'][$kw] ?? 0) / $maxKw, $keywords)) / count($keywords);
        }
        $speciesScore = min(1.0, max($exact, 0.7 * $kwScore));

        $maxSeller = $p['sellers'] ? max($p['sellers']) : 0;
        $sellerScore = $maxSeller > 0 ? ($p['sellers'][$sellerId] ?? 0) / $maxSeller : 0.0;

        $priceScore = 0.5;
        if ($p['median_log_price'] !== null && $expectedPrice > 0) {
            $priceScore = exp(-abs(log($expectedPrice) - $p['median_log_price']));
        }

        $recency = 0.0;
        if ($p['last_at']) {
            $days = max(0, Carbon::parse($p['last_at'])->diffInDays($referenceDate, false));
            $recency = exp(-$days / 90);
        }

        return ['species' => $speciesScore, 'seller' => $sellerScore, 'price' => $priceScore, 'recency' => $recency];
    }

    /** @return string[] */
    private function reasons(array $p, array $breakdown, string $species): array
    {
        $reasons = [];
        $speciesCount = $p['species'][$species] ?? 0;
        if ($speciesCount > 0) {
            $reasons[] = "「{$species}」への関心が高い（行動スコア" . round($speciesCount) . '）';
        } elseif ($breakdown['species'] > 0) {
            $reasons[] = '似た特徴の品種に関心がある';
        }
        if ($breakdown['seller'] >= 0.3) {
            $reasons[] = 'この出品者の生体を好む';
        }
        if ($p['median_log_price'] !== null && $breakdown['price'] >= 0.6) {
            $reasons[] = '価格帯が近い（中央値 ¥' . number_format(round(exp($p['median_log_price']))) . '）';
        }
        if ($p['wins'] > 0) {
            $reasons[] = "落札実績 {$p['wins']} 件";
        }
        return $reasons;
    }

    /** @return string[] */
    private function keywords(string $normalizedSpecies): array
    {
        if ($normalizedSpecies === '') {
            return [];
        }
        return array_values(array_filter(
            PriceFeatureEncoder::KEYWORDS,
            fn ($kw) => mb_strlen($kw) >= 2 && mb_strpos($normalizedSpecies, $kw) !== false,
        ));
    }

    /** @return int[] */
    private function houseBuyerIds(): array
    {
        return array_map('intval', (array) config('services.ai.house_buyer_ids', []));
    }
}
