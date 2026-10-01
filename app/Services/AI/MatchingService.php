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
 * 1. 購買プロファイル: 買受者ごとに過去の行動（落札3・指値2・入札参加1・お気に入り1）を、
 *    最近ほど重く（約半年で 1/e）集計し、活動量・品種・品種名の断片（文字2-gram）・出品者の傾向を数値化する
 * 2. 開催前の関心: その生体に開催前日までに入ったお気に入り（1）・指値（2）
 * 3. 点数 = 活動量 ×（1 + 2×同じ品種の割合 + 5×似た品種名の割合 + 2×同じ出品者の割合）+ 3×開催前の関心
 *
 * 係数は過去の開催で「実際の落札者が上位10人に入る割合」が最も高くなるものを選んだ（調整に使った開催と検証の開催は分けている）。
 * 終了済み・テスト以外の開催の行動だけを使い、テストユーザーと自社の下支え入札アカウントは除外する。
 */
class MatchingService
{
    private const EVENT_WEIGHTS = ['win' => 3.0, 'limit' => 2.0, 'bid' => 1.0, 'favorite' => 1.0];

    /** 行動の重みが 1/e になる日数 */
    private const DECAY_DAYS = 180;

    private const COEF_SAME_SPECIES = 2.0;
    private const COEF_SIMILAR_NAME = 5.0;
    private const COEF_SAME_SELLER = 2.0;
    private const COEF_DIRECT_INTEREST = 3.0;

    private const DIRECT_WEIGHTS = ['favorite' => 1.0, 'limit' => 2.0];

    private const CACHE_TTL_SECONDS = 1800;

    /** これ未満の落札しかない開催は、練習・デモとみなして検証に使わない */
    private const MIN_AUCTION_SAMPLES = 10;

    /**
     * 出品物に対して相性の良い買受者を返す
     *
     * @param  Carbon|null  $before  この日より前の開催の行動だけを使う（検証用）。null なら現在までのすべて
     * @return array<int, array{user_id: int, name: string, score: float, reasons: string[], wins: int, breakdown: array}>
     */
    public function matchBuyersForItem(Item $item, int $limit = 10, ?Carbon $before = null, ?float $expectedPrice = null): array
    {
        $profiles = $this->buyerProfiles($before);
        $direct = $this->directInterest($item, $before);
        $maxActivity = $profiles ? max(array_column($profiles, 'activity')) : 0.0;

        $species = PriceFeatureEncoder::normalizeSpecies((string) $item->species_name);
        $grams = $this->grams($species);
        $sellerId = (int) $item->seller_profile_id;

        $scored = [];
        foreach (array_unique(array_merge(array_keys($profiles), array_keys($direct))) as $userId) {
            $p = $profiles[$userId] ?? null;
            $breakdown = $p ? $this->affinity($p, $species, $grams, $sellerId, $maxActivity) : ['popularity' => 0.0, 'same_species' => 0.0, 'similar_name' => 0.0, 'same_seller' => 0.0];
            $breakdown['direct_interest'] = $direct[$userId] ?? 0.0;
            $score = $this->combine($breakdown);
            if ($score <= 0) {
                continue;
            }
            $scored[] = ['user_id' => (int) $userId, 'raw' => $score, 'breakdown' => $breakdown, 'profile' => $p];
        }

        usort($scored, fn ($a, $b) => $b['raw'] <=> $a['raw'] ?: $a['user_id'] <=> $b['user_id']);
        $scored = array_slice($scored, 0, $limit);
        $top = $scored[0]['raw'] ?? 1.0;

        $names = User::whereIn('id', array_column($scored, 'user_id'))->get(['id', 'name', 'trade_name'])->keyBy('id');

        return array_map(function ($row) use ($names, $species, $top, $expectedPrice, $item) {
            $user = $names->get($row['user_id']);
            return [
                'user_id' => $row['user_id'],
                'name' => (string) ($user?->trade_name ?: $user?->name ?: "ID:{$row['user_id']}"),
                // 画面表示用: 1位を 100 とした相対値
                'score' => round($row['raw'] / $top * 100, 1),
                'reasons' => $this->reasons($row['profile'], $row['breakdown'], $species, $expectedPrice ?? (float) $item->start_price),
                'wins' => (int) ($row['profile']['wins'] ?? 0),
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

        $rows = [];
        foreach ($items as $item) {
            $species = PriceFeatureEncoder::normalizeSpecies((string) $item->species_name);
            $breakdown = $this->affinity($profile, $species, $this->grams($species), (int) $item->seller_profile_id, $profile['activity']);
            $affinity = self::COEF_SAME_SPECIES * $breakdown['same_species']
                + self::COEF_SIMILAR_NAME * $breakdown['similar_name']
                + self::COEF_SAME_SELLER * $breakdown['same_seller'];
            if ($affinity <= 0) {
                continue;
            }
            $breakdown['direct_interest'] = 0.0;
            $rows[] = [
                'item_id' => $item->id,
                'affinity' => $affinity,
                'reason' => 'マッチング: ' . implode('・', array_slice($this->reasons($profile, $breakdown, $species, (float) $item->start_price), 0, 2)),
            ];
        }

        // 0〜1 に収める（この買受者にとって最も相性の良い出品物を 1）
        $max = $rows ? max(array_column($rows, 'affinity')) : 1.0;

        return array_map(fn ($r) => [
            'item_id' => $r['item_id'],
            'score' => round($r['affinity'] / $max, 4),
            'reason' => $r['reason'],
        ], $rows);
    }

    /**
     * 過去の開催で「実際の落札者が上位10人に入ったか」を検証する（予測力の確認）
     * 各開催について、その開催日より前の行動と、開催前日までのお気に入り・指値だけで判定する。
     *
     * @return array{auctions: int, items: int, hit_rate_at_10: float, baseline_hit_rate_at_10: float, coverage: float}
     */
    public function evaluate(int $recentAuctions = 3, int $k = 10): array
    {
        $house = $this->houseBuyerIds();
        $candidates = DB::table('auctions')
            ->where('status', 'finished')->where('is_test', false)
            ->whereNotIn('id', $this->excludedAuctionIds() ?: [0])
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
            // 比較用: 品種を見ずに「最近よく活動している人」上位 k 人
            $popular = collect($profiles)->sortByDesc('activity')->keys()->take($k)->all();

            foreach ($sold as $item) {
                $items++;
                $winner = (int) $item->winner_id;
                if (isset($profiles[$winner])) {
                    $covered++;
                }
                $top = array_column($this->matchBuyersForItem($item, $k, $before), 'user_id');
                if (in_array($winner, $top, true)) {
                    $hits++;
                }
                if (in_array($winner, $popular, true)) {
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
     * 買受者ごとの購買プロファイル（最近の行動ほど重い）
     *
     * @return array<int, array{activity: float, species: array<string, float>, grams: array<string, float>, sellers: array<int, float>, log_prices: float[], median_log_price: ?float, wins: int}>
     */
    public function buyerProfiles(?Carbon $before = null): array
    {
        $reference = ($before ?? now())->copy()->startOfDay();
        $key = 'ai:matching:profiles:v2:' . ($before ? $before->toDateString() : 'now:' . $reference->toDateString());

        return Cache::remember($key, self::CACHE_TTL_SECONDS, function () use ($before, $reference) {
            $profiles = [];

            foreach (self::EVENT_WEIGHTS as $type => $weight) {
                foreach ($this->events($type, $before) as $r) {
                    $userId = (int) $r->user_id;
                    $days = max(0, Carbon::parse($r->event_date)->startOfDay()->diffInDays($reference, false));
                    $w = $weight * (int) $r->cnt * exp(-$days / self::DECAY_DAYS);

                    $p = &$profiles[$userId];
                    $p ??= ['activity' => 0.0, 'species' => [], 'grams' => [], 'sellers' => [], 'log_prices' => [], 'median_log_price' => null, 'wins' => 0];
                    $p['activity'] += $w;

                    $norm = PriceFeatureEncoder::normalizeSpecies((string) $r->species_name);
                    if ($norm !== '') {
                        $p['species'][$norm] = ($p['species'][$norm] ?? 0) + $w;
                        foreach ($this->grams($norm) as $g) {
                            $p['grams'][$g] = ($p['grams'][$g] ?? 0) + $w;
                        }
                    }
                    $sellerId = (int) $r->seller_profile_id;
                    if ($sellerId) {
                        $p['sellers'][$sellerId] = ($p['sellers'][$sellerId] ?? 0) + $w;
                    }
                    if ($type === 'win') {
                        $p['wins'] += (int) $r->cnt;
                        if ((float) $r->price > 0) {
                            $p['log_prices'][] = log((float) $r->price);
                        }
                    }
                    unset($p);
                }
            }

            foreach ($profiles as &$p) {
                if ($p['log_prices']) {
                    sort($p['log_prices']);
                    $p['median_log_price'] = $p['log_prices'][intdiv(count($p['log_prices']), 2)];
                }
            }
            unset($p);

            return $profiles;
        });
    }

    /**
     * その生体に開催前に入ったお気に入り・指値（利用者ID => 重み）
     *
     * @return array<int, float>
     */
    private function directInterest(Item $item, ?Carbon $before): array
    {
        $interest = [];
        foreach (['favorite' => 'favorites', 'limit' => 'bid_limit_prices'] as $type => $table) {
            $rows = DB::table("{$table} as e")
                ->join('users as u', 'u.id', '=', 'e.user_id')
                ->where('e.item_id', $item->id)
                ->where('u.is_test', false)
                ->whereNotIn('e.user_id', $this->houseBuyerIds() ?: [0])
                // 検証時は開催前日までの分だけ（日付文字列で比較し、DB の型に依らず当日分を含めない）
                ->when($before, fn ($q) => $q->where('e.created_at', '<', $before->toDateString()))
                ->pluck('e.user_id');
            foreach ($rows as $userId) {
                $interest[(int) $userId] = ($interest[(int) $userId] ?? 0) + self::DIRECT_WEIGHTS[$type];
            }
        }

        return $interest;
    }

    /**
     * 行動を「利用者×品種×出品者×開催日」単位で集計して読む（終了済み・テスト以外の開催、テストユーザー・自社アカウント除外）
     */
    private function events(string $type, ?Carbon $before): \Illuminate\Support\Collection
    {
        [$table, $userCol, $priceExpr] = match ($type) {
            'win' => ['won_items', 'winner_id', 'AVG(e.winning_price)'],
            'limit' => ['bid_limit_prices', 'user_id', 'NULL'],
            'bid' => ['bid_events', 'user_id', 'NULL'],
            'favorite' => ['favorites', 'user_id', 'NULL'],
        };

        return DB::table("{$table} as e")
            ->join('items as i', 'i.id', '=', 'e.item_id')
            ->join('auctions as a', 'a.id', '=', 'i.auction_id')
            ->join('users as u', 'u.id', '=', "e.{$userCol}")
            ->where('a.status', 'finished')
            ->where('a.is_test', false)
            ->whereNotIn('a.id', $this->excludedAuctionIds() ?: [0])
            ->where('u.is_test', false)
            ->whereNotIn("e.{$userCol}", $this->houseBuyerIds() ?: [0])
            ->when($type === 'bid', fn ($q) => $q->where('e.event_type', 'join'))
            // 日付文字列で比較する（SQLite は文字列比較のため Carbon を渡すと当日分が混ざる）
            ->when($before, fn ($q) => $q->where('a.event_date', '<', $before->toDateString()))
            ->groupBy("e.{$userCol}", 'i.species_name', 'i.seller_profile_id', 'a.event_date')
            ->selectRaw("e.{$userCol} as user_id, i.species_name, i.seller_profile_id, a.event_date, COUNT(*) as cnt, {$priceExpr} as price")
            ->get();
    }

    /**
     * @return array{popularity: float, same_species: float, similar_name: float, same_seller: float}
     */
    private function affinity(array $p, string $species, array $grams, int $sellerId, float $maxActivity): array
    {
        $activity = $p['activity'] ?: 1e-9;

        $similar = 0.0;
        if ($grams) {
            $similar = array_sum(array_map(fn ($g) => $p['grams'][$g] ?? 0, $grams)) / count($grams) / $activity;
        }

        return [
            'popularity' => $maxActivity > 0 ? log1p($p['activity']) / log1p($maxActivity) : 0.0,
            'same_species' => ($p['species'][$species] ?? 0) / $activity,
            'similar_name' => $similar,
            'same_seller' => ($p['sellers'][$sellerId] ?? 0) / $activity,
        ];
    }

    private function combine(array $b): float
    {
        return $b['popularity'] * (1
                + self::COEF_SAME_SPECIES * $b['same_species']
                + self::COEF_SIMILAR_NAME * $b['similar_name']
                + self::COEF_SAME_SELLER * $b['same_seller'])
            + self::COEF_DIRECT_INTEREST * $b['direct_interest'];
    }

    /** @return string[] */
    private function reasons(?array $p, array $b, string $species, float $expectedPrice): array
    {
        $reasons = [];
        if ($b['direct_interest'] >= self::DIRECT_WEIGHTS['limit']) {
            $reasons[] = 'この生体に指値あり';
        } elseif ($b['direct_interest'] > 0) {
            $reasons[] = 'この生体をお気に入り登録';
        }
        if ($b['same_species'] > 0) {
            $reasons[] = "「{$species}」の購入・入札歴あり";
        } elseif ($b['similar_name'] >= 0.05) {
            $reasons[] = '似た品種に関心がある';
        }
        if ($b['same_seller'] >= 0.15) {
            $reasons[] = 'この出品者の生体を好む';
        }
        if ($p && $p['median_log_price'] !== null && $expectedPrice > 0 && abs(log($expectedPrice) - $p['median_log_price']) < 0.5) {
            $reasons[] = '価格帯が近い（落札中央値 ¥' . number_format(round(exp($p['median_log_price']))) . '）';
        }
        if ($p && $p['wins'] > 0) {
            $reasons[] = "落札実績 {$p['wins']} 件";
        }
        return $reasons;
    }

    /** @return string[] 品種名の文字2-gram（1文字の名前はその文字） */
    private function grams(string $normalizedSpecies): array
    {
        if ($normalizedSpecies === '') {
            return [];
        }
        $grams = array_values(array_unique(PriceFeatureEncoder::bigrams($normalizedSpecies)));
        return $grams ?: [$normalizedSpecies];
    }

    /** @return int[] */
    private function houseBuyerIds(): array
    {
        return array_map('intval', (array) config('services.ai.house_buyer_ids', []));
    }

    /** @return int[] */
    private function excludedAuctionIds(): array
    {
        return array_map('intval', (array) config('services.ai.excluded_auction_ids', []));
    }
}
