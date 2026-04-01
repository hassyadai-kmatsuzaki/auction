<?php

namespace App\Services;

use App\Models\BagSpec;
use App\Models\BoxSpec;
use App\Models\PackingMaterial;
use App\Models\PrefectureRegion;
use App\Models\ShippingRate;
use Illuminate\Support\Facades\Cache;

class ShippingCalculatorService
{
    private array $bagSpecs;
    private array $boxSpecs;
    private array $packingMaterials;
    private array $shippingRates;

    private const CACHE_TTL = 3600;

    public function __construct()
    {
        $this->loadMasterData();
    }

    /**
     * 配送料金を計算する
     *
     * @param array $items [['quantity' => int], ...]
     * @param string $destinationRegion 配送先地域
     * @return array
     */
    public function calculate(array $items, string $destinationRegion): array
    {
        // 1) 匹数から袋サイズ・袋数を決定
        $bags = $this->determineBags($items);

        // 2) 袋の組み合わせから最小箱構成を決定（Greedy Bin-Packing）
        $boxes = $this->packBags($bags);

        // 3) 各箱の（送料 + 梱包資材費）を合算
        $totalShippingCost = 0;
        $totalPackingCost = 0;
        $boxDetails = [];

        foreach ($boxes as $box) {
            $rate = $this->getShippingRate($destinationRegion, $box['box_size']);
            $packingCost = $this->getPackingMaterialCost($box['box_size']);

            $totalShippingCost += $rate;
            $totalPackingCost += $packingCost;

            $boxDetails[] = [
                'box_size' => $box['box_size'],
                'bags' => $this->formatBagsInBox($box['bags']),
                'shipping_cost' => $rate,
                'packing_material_cost' => $packingCost,
            ];
        }

        return [
            'bags' => $this->formatBagsSummary($bags),
            'boxes' => $boxDetails,
            'shipping_cost' => $totalShippingCost,
            'packing_material_cost' => $totalPackingCost,
            'total_shipping_fee' => $totalShippingCost + $totalPackingCost,
            'destination_region' => $destinationRegion,
        ];
    }

    /**
     * 都道府県名から配送地域を取得
     */
    public function getRegionByPrefecture(string $prefecture): ?string
    {
        // 「都」「府」「県」を除去して照合
        $normalized = preg_replace('/(都|道|府|県)$/', '', $prefecture);

        return Cache::remember("prefecture_region_{$normalized}", self::CACHE_TTL, function () use ($normalized) {
            $record = PrefectureRegion::where('prefecture', $normalized)
                ->orWhere('prefecture', $normalized . '都')
                ->orWhere('prefecture', $normalized . '道')
                ->orWhere('prefecture', $normalized . '府')
                ->orWhere('prefecture', $normalized . '県')
                ->first();

            return $record?->region;
        });
    }

    /**
     * 匹数から袋サイズ・袋数を決定
     */
    private function determineBags(array $items): array
    {
        $bags = ['S' => 0, 'M' => 0, 'L' => 0, 'LL' => 0];

        foreach ($items as $item) {
            $qty = $item['quantity'];
            $itemBags = $this->determineBagsForQuantity($qty);
            foreach ($itemBags as $size => $count) {
                $bags[$size] += $count;
            }
        }

        return array_filter($bags, fn($count) => $count > 0);
    }

    /**
     * 1出品の匹数から最適な袋構成を決定
     */
    private function determineBagsForQuantity(int $quantity): array
    {
        $bags = ['S' => 0, 'M' => 0, 'L' => 0, 'LL' => 0];
        $remaining = $quantity;

        // 大きい袋から順に割り当て
        foreach (['LL', 'L', 'M', 'S'] as $size) {
            $spec = $this->bagSpecs[$size];
            $minQty = $spec['min_qty'];
            $maxQty = $spec['max_qty'] ?? PHP_INT_MAX;

            while ($remaining >= $minQty) {
                $bagged = min($remaining, $maxQty);
                $bags[$size]++;
                $remaining -= $bagged;
                if ($remaining <= 0) break;
            }
            if ($remaining <= 0) break;
        }

        // 残りがあればS袋に入れる（min_qty未満でも1袋必要）
        if ($remaining > 0) {
            $bags['S']++;
        }

        return array_filter($bags, fn($count) => $count > 0);
    }

    /**
     * Greedy Bin-Packing: 袋を箱に詰める
     */
    private function packBags(array $bags): array
    {
        $s  = $bags['S'] ?? 0;
        $m  = $bags['M'] ?? 0;
        $l  = $bags['L'] ?? 0;
        $ka = $bags['LL'] ?? 0;

        // Phase 0: 全袋が1箱に収まるか試行（80→100→120→140の順）
        foreach ([80, 100, 120, 140] as $boxSize) {
            if ($this->fitsInBox($s, $m, $l, $ka, $boxSize)) {
                return [['box_size' => $boxSize, 'bags' => ['S' => $s, 'M' => $m, 'L' => $l, 'LL' => $ka]]];
            }
        }

        // Phase 1-4: 個別にパッキング
        $boxes = [];

        // Phase 1: LL袋を140サイズに1個ずつ割当
        for ($i = 0; $i < $ka; $i++) {
            $boxes[] = ['box_size' => 140, 'bags' => ['S' => 0, 'M' => 0, 'L' => 0, 'LL' => 1]];
        }

        // Phase 2: L袋を最小適合箱に割当（120に1個 or 140に2個）
        $remainingL = $l;
        while ($remainingL >= 2) {
            $boxes[] = ['box_size' => 140, 'bags' => ['S' => 0, 'M' => 0, 'L' => 2, 'LL' => 0]];
            $remainingL -= 2;
        }
        if ($remainingL === 1) {
            $boxes[] = ['box_size' => 120, 'bags' => ['S' => 0, 'M' => 0, 'L' => 1, 'LL' => 0]];
            $remainingL = 0;
        }

        // Phase 3: M袋を最小適合箱に割当（100に1個 / 120に2個 / 140に3個）
        $remainingM = $m;
        while ($remainingM >= 3) {
            $boxes[] = ['box_size' => 140, 'bags' => ['S' => 0, 'M' => 3, 'L' => 0, 'LL' => 0]];
            $remainingM -= 3;
        }
        if ($remainingM === 2) {
            $boxes[] = ['box_size' => 120, 'bags' => ['S' => 0, 'M' => 2, 'L' => 0, 'LL' => 0]];
            $remainingM = 0;
        } elseif ($remainingM === 1) {
            $boxes[] = ['box_size' => 100, 'bags' => ['S' => 0, 'M' => 1, 'L' => 0, 'LL' => 0]];
            $remainingM = 0;
        }

        // Phase 4: S袋を残りスペースに詰め、溢れは新箱に割当
        $remainingS = $s;

        // まず既存箱の空きスペースにS袋を詰める
        foreach ($boxes as &$box) {
            if ($remainingS <= 0) break;
            $currentS = $box['bags']['S'];
            $maxS = $this->getMaxSInBox($box['bags'], $box['box_size']);
            $available = $maxS - $currentS;
            if ($available > 0) {
                $add = min($available, $remainingS);
                $box['bags']['S'] += $add;
                $remainingS -= $add;
            }
        }
        unset($box);

        // 溢れたS袋を新箱に
        while ($remainingS > 0) {
            // S袋の箱サイズ: 80に1, 100に2, 120に6, 140に9
            foreach ([80 => 1, 100 => 2, 120 => 6, 140 => 9] as $boxSize => $maxCount) {
                if ($remainingS <= $maxCount) {
                    $boxes[] = ['box_size' => $boxSize, 'bags' => ['S' => $remainingS, 'M' => 0, 'L' => 0, 'LL' => 0]];
                    $remainingS = 0;
                    break;
                }
            }
            if ($remainingS > 0) {
                // 140に9個詰めて残りを次のループへ
                $boxes[] = ['box_size' => 140, 'bags' => ['S' => 9, 'M' => 0, 'L' => 0, 'LL' => 0]];
                $remainingS -= 9;
            }
        }

        return $boxes;
    }

    /**
     * 袋の組み合わせが指定箱サイズに入るか判定
     */
    private function fitsInBox(int $s, int $m, int $l, int $ka, int $boxSize): bool
    {
        // 重量チェック
        $totalWeight = $s * 2.2 + $m * 5.5 + $l * 8.0 + $ka * 15.0;
        $spec = $this->boxSpecs[$boxSize];
        if ($totalWeight > $spec['max_weight_kg']) {
            return false;
        }

        // 採用枠チェック
        if ($s > $spec['max_s'] || $m > $spec['max_m'] || $l > $spec['max_l'] || $ka > $spec['max_ll']) {
            return false;
        }

        // 混載制約
        if ($boxSize === 100 && $s > 0 && $m > 0) {
            return false; // S+M → 100に入らない
        }
        if ($ka > 0 && ($m > 0 || $l > 0)) {
            return false; // LL + M/L 混載不可
        }
        if ($boxSize === 120 && $s > 0 && $l > 0) {
            return false; // S+L → 120に入らない
        }

        return true;
    }

    /**
     * 箱内の既存袋構成でS袋を追加できる最大数を返す
     */
    private function getMaxSInBox(array $bags, int $boxSize): int
    {
        $spec = $this->boxSpecs[$boxSize];
        $m = $bags['M'] ?? 0;
        $l = $bags['L'] ?? 0;
        $ka = $bags['LL'] ?? 0;

        // LL or L が入っている箱にはS袋混載制約あり
        if ($ka > 0) {
            return 0; // LL + S は可能だが、LL箱は140固定で余裕が限られる
        }

        // 混載制約: S+M→100不可, S+L→120不可
        if ($m > 0 && $boxSize <= 100) {
            return 0;
        }
        if ($l > 0 && $boxSize <= 120) {
            return 0;
        }

        // 重量制約
        $currentWeight = ($bags['S'] ?? 0) * 2.2 + $m * 5.5 + $l * 8.0 + $ka * 15.0;
        $remainingWeight = $spec['max_weight_kg'] - $currentWeight;
        $maxByWeight = (int) floor($remainingWeight / 2.2);

        // 枠制約
        $maxBySlot = $spec['max_s'] - ($bags['S'] ?? 0);

        return max(0, min($maxByWeight, $maxBySlot));
    }

    private function getShippingRate(string $region, int $boxSize): int
    {
        $key = "{$region}_{$boxSize}";
        return $this->shippingRates[$key] ?? 0;
    }

    private function getPackingMaterialCost(int $boxSize): int
    {
        return $this->packingMaterials[$boxSize] ?? 0;
    }

    private function formatBagsInBox(array $bags): array
    {
        $result = [];
        foreach (['S', 'M', 'L', 'LL'] as $size) {
            $count = $bags[$size] ?? 0;
            if ($count > 0) {
                $result[] = "{$size}×{$count}";
            }
        }
        return $result;
    }

    private function formatBagsSummary(array $bags): array
    {
        $result = [];
        foreach ($bags as $size => $count) {
            $result[] = ['size' => $size, 'quantity' => $count];
        }
        return $result;
    }

    /**
     * マスタデータをキャッシュ付きでロード
     */
    private function loadMasterData(): void
    {
        $this->bagSpecs = Cache::remember('shipping_bag_specs', self::CACHE_TTL, function () {
            $specs = [];
            foreach (BagSpec::all() as $bag) {
                $specs[$bag->bag_size] = [
                    'min_qty' => $bag->min_qty,
                    'max_qty' => $bag->max_qty,
                    'weight_kg' => (float) $bag->weight_kg,
                ];
            }
            return $specs;
        });

        $this->boxSpecs = Cache::remember('shipping_box_specs', self::CACHE_TTL, function () {
            $specs = [];
            foreach (BoxSpec::all() as $box) {
                $specs[$box->box_size] = [
                    'max_weight_kg' => $box->max_weight_kg,
                    'max_s' => $box->max_s,
                    'max_m' => $box->max_m,
                    'max_l' => $box->max_l,
                    'max_ll' => $box->max_ll,
                ];
            }
            return $specs;
        });

        $this->shippingRates = Cache::remember('shipping_rates_map', self::CACHE_TTL, function () {
            $rates = [];
            foreach (ShippingRate::all() as $rate) {
                $rates["{$rate->region}_{$rate->box_size}"] = $rate->rate;
            }
            return $rates;
        });

        $this->packingMaterials = Cache::remember('shipping_packing_materials', self::CACHE_TTL, function () {
            $materials = [];
            foreach (PackingMaterial::all() as $mat) {
                $materials[$mat->box_size] = $mat->total_cost;
            }
            return $materials;
        });
    }

    /**
     * キャッシュクリア（マスタ更新時に呼ぶ）
     */
    public static function clearCache(): void
    {
        Cache::forget('shipping_bag_specs');
        Cache::forget('shipping_box_specs');
        Cache::forget('shipping_rates_map');
        Cache::forget('shipping_packing_materials');
    }
}
