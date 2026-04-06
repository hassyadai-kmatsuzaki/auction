<?php

namespace App\Services;

use App\Models\BagSpec;
use App\Models\BoxSpec;
use App\Models\PackingMaterial;
use App\Models\PrefectureRegion;
use App\Models\ShippingRate;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ShippingCalculatorService
{
    private array $bagSpecs;
    private array $boxSpecs;
    private array $boxCapacities;
    private array $packingMaterials;
    private array $shippingRates;

    /** アクティブな箱サイズ（120不採用） */
    private const BOX_SIZES = [80, 100, 140];

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
        $bags = $this->determineBags($items);
        $boxes = $this->packBags($bags);

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
        $bags = ['S' => 0, 'M' => 0, 'L' => 0, 'KA' => 0];

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
        $bags = ['S' => 0, 'M' => 0, 'L' => 0, 'KA' => 0];
        $remaining = $quantity;

        foreach (['KA', 'L', 'M', 'S'] as $size) {
            $spec = $this->bagSpecs[$size] ?? null;
            if (!$spec) continue;

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

        if ($remaining > 0) {
            $bags['S']++;
        }

        return array_filter($bags, fn($count) => $count > 0);
    }

    /**
     * Greedy Bin-Packing: 袋を箱に詰める（120不採用・5フェーズ）
     *
     * Phase 0: 全袋が1箱に収まるか試行 (80→100→140)
     * Phase 1: KA袋 → 140に1個ずつ割当（S袋との同梱を試みる）
     * Phase 2: L袋 → 140に割当（M/S袋との同梱を試みる）
     * Phase 3: M袋 → 最小適合箱に割当（100に1個 / 140に2-3個）
     * Phase 4: S袋 → 残りスペースに詰め、溢れは新箱に割当
     */
    private function packBags(array $bags): array
    {
        $s  = $bags['S'] ?? 0;
        $m  = $bags['M'] ?? 0;
        $l  = $bags['L'] ?? 0;
        $ka = $bags['KA'] ?? 0;

        // Phase 0: 全袋が1箱に収まるか試行
        foreach (self::BOX_SIZES as $boxSize) {
            if ($this->fitsInBox($s, $m, $l, $ka, $boxSize)) {
                return [['box_size' => $boxSize, 'bags' => ['S' => $s, 'M' => $m, 'L' => $l, 'KA' => $ka]]];
            }
        }

        $boxes = [];

        // Phase 1: KA → 140 (1個/箱、S袋との同梱を試みる)
        while ($ka > 0) {
            $boxes[] = ['box_size' => 140, 'bags' => ['S' => 0, 'M' => 0, 'L' => 0, 'KA' => 1]];
            $ka--;
            // KA(15kg) + S×n → 15 + n*2.2 ≤ 20 → n ≤ 2
            $sFit = min($s, 2);
            $boxes[count($boxes) - 1]['bags']['S'] = $sFit;
            $s -= $sFit;
        }

        // Phase 2: L → 140
        while ($l > 0) {
            $boxes[] = ['box_size' => 140, 'bags' => ['S' => 0, 'M' => 0, 'L' => 0, 'KA' => 0]];
            $idx = count($boxes) - 1;
            if ($l >= 2) {
                // L×2 = 16kg → 残り4kg → S×1(2.2kg)のみ可
                $boxes[$idx]['bags']['L'] = 2;
                $l -= 2;
                $sFit = min($s, 1);
                $boxes[$idx]['bags']['S'] = $sFit;
                $s -= $sFit;
            } else {
                // L×1 = 8kg → M/Sとの同梱を試みる
                $boxes[$idx]['bags']['L'] = 1;
                $l--;
                // L×1 + M×n: 8+5.5n ≤ 20 → n ≤ 2
                $mFit = min($m, 2);
                $boxes[$idx]['bags']['M'] = $mFit;
                $m -= $mFit;
                // 残り重量でSを詰める
                $remainingWeight = 20.0 - 8.0 - ($mFit * 5.5);
                $sFit = min($s, (int) floor($remainingWeight / 2.2));
                $boxes[$idx]['bags']['S'] = $sFit;
                $s -= $sFit;
            }
        }

        // Phase 3: M → 100(1個) or 140(2-3個)
        while ($m > 0) {
            if ($m === 1 && $s === 0) {
                // M単独 → 100
                $boxes[] = ['box_size' => 100, 'bags' => ['S' => 0, 'M' => 1, 'L' => 0, 'KA' => 0]];
                $m--;
            } elseif ($m >= 2) {
                // M×2-3 → 140
                $mFit = min($m, 3);
                $boxes[] = ['box_size' => 140, 'bags' => ['S' => 0, 'M' => $mFit, 'L' => 0, 'KA' => 0]];
                $m -= $mFit;
                $remainingWeight = 20.0 - ($mFit * 5.5);
                $sFit = min($s, 9, (int) floor($remainingWeight / 2.2));
                $boxes[count($boxes) - 1]['bags']['S'] = $sFit;
                $s -= $sFit;
            } else {
                // M×1 + S → 140 (100ではS+M混載不可)
                $boxes[] = ['box_size' => 140, 'bags' => ['S' => 0, 'M' => 1, 'L' => 0, 'KA' => 0]];
                $m--;
                $remainingWeight = 20.0 - 5.5;
                $sFit = min($s, 9, (int) floor($remainingWeight / 2.2));
                $boxes[count($boxes) - 1]['bags']['S'] = $sFit;
                $s -= $sFit;
            }
        }

        // Phase 4: S → 80(1個) / 100(2個) / 140(3-9個)
        while ($s > 0) {
            if ($s === 1) {
                $boxes[] = ['box_size' => 80, 'bags' => ['S' => 1, 'M' => 0, 'L' => 0, 'KA' => 0]];
                $s--;
            } elseif ($s === 2) {
                $boxes[] = ['box_size' => 100, 'bags' => ['S' => 2, 'M' => 0, 'L' => 0, 'KA' => 0]];
                $s -= 2;
            } else {
                $fit = min($s, 9);
                $boxes[] = ['box_size' => 140, 'bags' => ['S' => $fit, 'M' => 0, 'L' => 0, 'KA' => 0]];
                $s -= $fit;
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
        $spec = $this->boxSpecs[$boxSize] ?? null;
        if (!$spec || $totalWeight > $spec['max_weight_kg']) {
            return false;
        }

        // 容量チェック（box_capacities テーブル参照）
        $caps = $this->boxCapacities[$boxSize] ?? [];
        if ($s > ($caps['S'] ?? 0) || $m > ($caps['M'] ?? 0) ||
            $l > ($caps['L'] ?? 0) || $ka > ($caps['KA'] ?? 0)) {
            return false;
        }

        // 混載制約: 100でS+M不可
        if ($boxSize === 100 && $s > 0 && $m > 0) {
            return false;
        }
        // KA + M/L 混載不可
        if ($ka > 0 && ($m > 0 || $l > 0)) {
            return false;
        }

        return true;
    }

    private function getShippingRate(string $region, int $boxSize): int
    {
        return $this->shippingRates["{$region}_{$boxSize}"] ?? 0;
    }

    private function getPackingMaterialCost(int $boxSize): int
    {
        return $this->packingMaterials[$boxSize] ?? 0;
    }

    private function formatBagsInBox(array $bags): array
    {
        $result = [];
        foreach (['S', 'M', 'L', 'KA'] as $size) {
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
                ];
            }
            return $specs;
        });

        $this->boxCapacities = Cache::remember('shipping_box_capacities', self::CACHE_TTL, function () {
            $caps = [];
            foreach (DB::table('box_capacities')->get() as $row) {
                $caps[$row->box_size][$row->bag_size] = $row->max_count;
            }
            return $caps;
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

    public static function clearCache(): void
    {
        Cache::forget('shipping_bag_specs');
        Cache::forget('shipping_box_specs');
        Cache::forget('shipping_box_capacities');
        Cache::forget('shipping_rates_map');
        Cache::forget('shipping_packing_materials');
    }
}
