<?php

namespace App\Services;

use App\Models\BagSpec;
use App\Models\BoxSpec;
use App\Models\PackingMaterial;
use App\Models\PrefectureRegion;
use App\Models\ShippingRate;
use App\Models\SpeciesType;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ShippingCalculatorService
{
    /** アクティブな箱サイズ（120不採用） */
    private const BOX_SIZES = [80, 100, 140];

    private const CACHE_TTL = 3600;

    /** 種別スコープ済みの箱・袋マスタを格納（lazy load） */
    private array $speciesMasters = [];

    /** 種別非依存の共通マスタ */
    private array $boxSpecs = [];
    private array $shippingRates = [];
    private array $packingMaterials = [];

    /** SpeciesType 行キャッシュ（id => model） */
    private array $speciesById = [];
    /** code => id */
    private array $speciesIdByCode = [];
    /** デフォルト種別 ID（item に species_type_id が欠損している場合の fallback） */
    private ?int $defaultSpeciesId = null;

    public function __construct()
    {
        $this->loadCommonMasters();
        $this->loadSpeciesIndex();
    }

    /**
     * 配送料金を計算する（エントリーポイント）。
     *
     * $items の各要素は以下の形式：
     *   ['quantity' => int, 'species_type_id' => int|null]
     *
     * 後方互換: species_type_id が欠損している場合はデフォルト種別（メダカ）とみなす。
     *
     * 戦略分岐:
     *   - 発送単位内に manual 種別が 1 件でも含まれる  → manual（合計は null）
     *   - 単一 auto 種別のみ                          → auto（従来ロジック）
     *   - 複数 auto 種別が混在                         → mixed（種別ごとに自動計算し合算）
     *
     * @param array $items
     * @param string $destinationRegion
     * @return array
     */
    public function calculate(array $items, string $destinationRegion): array
    {
        $grouped = $this->groupItemsBySpecies($items);
        $modes = [];
        foreach ($grouped as $speciesId => $_) {
            $modes[$speciesId] = $this->getSpecies($speciesId)->calculation_mode;
        }

        // manual を含む → 全体 manual
        if (in_array(SpeciesType::MODE_MANUAL, $modes, true)) {
            return $this->buildManualResult($grouped, $destinationRegion);
        }

        // 単一 auto 種別
        if (count($grouped) === 1) {
            $speciesId = array_key_first($grouped);
            $result = $this->calculateForSpecies($speciesId, $grouped[$speciesId], $destinationRegion);
            $result['calculation_mode'] = 'auto';
            $result['species_breakdown'] = [[
                'species_type_id' => $speciesId,
                'species_code' => $this->getSpecies($speciesId)->code,
                'species_name' => $this->getSpecies($speciesId)->name,
                'quantity' => array_sum(array_map(fn ($i) => $i['quantity'], $grouped[$speciesId])),
                'subtotal_fee' => $result['total_shipping_fee'],
            ]];
            return $result;
        }

        // 複数 auto 種別 → mixed
        return $this->buildMixedResult($grouped, $destinationRegion);
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
     * 配送料を各落札品に按分する（残差は最後の要素で吸収し、合計が必ず $totalFee と一致）
     *
     * @param int $totalFee
     * @param int[] $quantities
     * @return int[]
     */
    public static function apportionFee(int $totalFee, array $quantities): array
    {
        $count = count($quantities);
        if ($count === 0) return [];

        $totalQty = array_sum($quantities);
        if ($totalQty <= 0) {
            $base = intdiv($totalFee, $count);
            $result = array_fill(0, $count, $base);
            $result[$count - 1] = $totalFee - $base * ($count - 1);
            return $result;
        }

        $assigned = 0;
        $result = [];
        $i = 0;
        foreach ($quantities as $qty) {
            if ($i === $count - 1) {
                $result[] = $totalFee - $assigned;
            } else {
                $fee = (int) round($totalFee * ($qty / $totalQty));
                $result[] = $fee;
                $assigned += $fee;
            }
            $i++;
        }
        return $result;
    }

    public static function clearCache(): void
    {
        Cache::forget('shipping_box_specs');
        Cache::forget('shipping_rates_map');
        Cache::forget('shipping_packing_materials');
        Cache::forget('shipping_species_index');
        // 種別スコープキャッシュ（全種別）
        foreach (DB::table('species_types')->pluck('id') as $id) {
            Cache::forget("shipping_bag_specs_species_{$id}");
            Cache::forget("shipping_box_capacities_species_{$id}");
            Cache::forget("shipping_mix_restrictions_species_{$id}");
        }
    }

    // ══════════════════════════════════════════════════════════════
    // 内部: 種別ごとの計算（既存メダカロジックを種別パラメータで駆動）
    // ══════════════════════════════════════════════════════════════

    /**
     * 指定種別のマスタで送料を計算する（auto 種別専用）。
     */
    private function calculateForSpecies(int $speciesId, array $items, string $destinationRegion): array
    {
        $this->loadSpeciesMasters($speciesId);

        $bags = $this->determineBags($speciesId, $items);
        $boxes = $this->packBags($speciesId, $bags);

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
     * 匹数から袋サイズ・袋数を決定
     */
    private function determineBags(int $speciesId, array $items): array
    {
        $bagSizes = array_keys($this->speciesMasters[$speciesId]['bag_specs']);
        $bags = array_fill_keys($bagSizes, 0);

        foreach ($items as $item) {
            $qty = $item['quantity'];
            $itemBags = $this->determineBagsForQuantity($speciesId, $qty);
            foreach ($itemBags as $size => $count) {
                $bags[$size] = ($bags[$size] ?? 0) + $count;
            }
        }

        return array_filter($bags, fn($count) => $count > 0);
    }

    /**
     * 1出品の匹数から最適な袋構成を決定（min_qty 降順で貪欲）
     */
    private function determineBagsForQuantity(int $speciesId, int $quantity): array
    {
        $specs = $this->speciesMasters[$speciesId]['bag_specs'];
        // min_qty 降順で詰める
        uksort($specs, fn ($a, $b) => $specs[$b]['min_qty'] <=> $specs[$a]['min_qty']);

        $bags = array_fill_keys(array_keys($specs), 0);
        $remaining = $quantity;

        foreach ($specs as $size => $spec) {
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
            // 端数は最小袋（min_qty が最小のもの）に追加
            $smallest = array_key_last($specs);
            $bags[$smallest]++;
        }

        return array_filter($bags, fn($count) => $count > 0);
    }

    /**
     * Greedy Bin-Packing（メダカ互換ロジック）。
     * 袋サイズの呼称は species ごとに異なりうるが、min_qty 順で KA/L/M/S 相当に
     * マッピングしてフェーズ処理する。
     *
     * 既存の挙動を保つため、袋識別子 S/M/L/KA のケースを優先し、未知の袋セットの
     * 場合は min_qty 降順で「最大→最小」の順に詰める汎用ロジックに落とす。
     */
    private function packBags(int $speciesId, array $bags): array
    {
        $hasStandard = isset($this->speciesMasters[$speciesId]['bag_specs']['S'])
            && isset($this->speciesMasters[$speciesId]['bag_specs']['M'])
            && isset($this->speciesMasters[$speciesId]['bag_specs']['L'])
            && isset($this->speciesMasters[$speciesId]['bag_specs']['KA']);

        if ($hasStandard) {
            return $this->packBagsStandard($speciesId, $bags);
        }

        return $this->packBagsGeneric($speciesId, $bags);
    }

    /**
     * S/M/L/KA 4 袋前提の既存メダカ互換パッキング（リグレッション保持用）。
     */
    private function packBagsStandard(int $speciesId, array $bags): array
    {
        $s  = $bags['S'] ?? 0;
        $m  = $bags['M'] ?? 0;
        $l  = $bags['L'] ?? 0;
        $ka = $bags['KA'] ?? 0;

        // Phase 0: 全袋が1箱に収まるか試行
        foreach (self::BOX_SIZES as $boxSize) {
            if ($this->fitsInBox($speciesId, $s, $m, $l, $ka, $boxSize)) {
                return [['box_size' => $boxSize, 'bags' => ['S' => $s, 'M' => $m, 'L' => $l, 'KA' => $ka]]];
            }
        }

        $boxes = [];

        // Phase 1: KA → 140 (1個/箱、Sのみ同梱可)
        while ($ka > 0) {
            $box = ['S' => 0, 'M' => 0, 'L' => 0, 'KA' => 1];
            $ka--;
            $sFit = $this->maxAdditionalStandard($speciesId, $box, 'S', 140, $s);
            $box['S'] = $sFit;
            $s -= $sFit;
            $boxes[] = ['box_size' => 140, 'bags' => $box];
        }

        // Phase 2: L → 140
        while ($l > 0) {
            $box = ['S' => 0, 'M' => 0, 'L' => 0, 'KA' => 0];
            $lFit = $this->maxAdditionalStandard($speciesId, $box, 'L', 140, $l);
            $box['L'] = $lFit;
            $l -= $lFit;
            $mFit = $this->maxAdditionalStandard($speciesId, $box, 'M', 140, $m);
            $box['M'] = $mFit;
            $m -= $mFit;
            $sFit = $this->maxAdditionalStandard($speciesId, $box, 'S', 140, $s);
            $box['S'] = $sFit;
            $s -= $sFit;
            $boxes[] = ['box_size' => 140, 'bags' => $box];
        }

        // Phase 3: M → 100(1個) or 140(2-3個)
        $caps100 = $this->speciesMasters[$speciesId]['box_capacities'][100] ?? [];
        while ($m > 0) {
            if ($s === 0 && $this->fitsInBox($speciesId, 0, $m, 0, 0, 100) && $m <= ($caps100['M'] ?? 0)) {
                $boxes[] = ['box_size' => 100, 'bags' => ['S' => 0, 'M' => $m, 'L' => 0, 'KA' => 0]];
                $m = 0;
                break;
            }
            $box = ['S' => 0, 'M' => 0, 'L' => 0, 'KA' => 0];
            $mFit = $this->maxAdditionalStandard($speciesId, $box, 'M', 140, $m);
            $box['M'] = $mFit;
            $m -= $mFit;
            $sFit = $this->maxAdditionalStandard($speciesId, $box, 'S', 140, $s);
            $box['S'] = $sFit;
            $s -= $sFit;
            $boxes[] = ['box_size' => 140, 'bags' => $box];
        }

        // Phase 4: S → 残りの S を最小適合箱で
        while ($s > 0) {
            $placed = false;
            foreach (self::BOX_SIZES as $boxSize) {
                $sFit = $this->maxAdditionalStandard(
                    $speciesId,
                    ['S' => 0, 'M' => 0, 'L' => 0, 'KA' => 0],
                    'S', $boxSize, $s
                );
                if ($sFit <= 0) continue;
                if ($sFit >= $s) {
                    $boxes[] = ['box_size' => $boxSize, 'bags' => ['S' => $s, 'M' => 0, 'L' => 0, 'KA' => 0]];
                    $s = 0;
                    $placed = true;
                    break;
                }
            }
            if ($placed) break;

            $maxBox = max(self::BOX_SIZES);
            $sFit = $this->maxAdditionalStandard(
                $speciesId,
                ['S' => 0, 'M' => 0, 'L' => 0, 'KA' => 0],
                'S', $maxBox, $s
            );
            if ($sFit <= 0) {
                throw new \RuntimeException("S袋を箱に詰められません（マスタ設定を確認してください）");
            }
            $boxes[] = ['box_size' => $maxBox, 'bags' => ['S' => $sFit, 'M' => 0, 'L' => 0, 'KA' => 0]];
            $s -= $sFit;
        }

        return $boxes;
    }

    /**
     * 袋セットが S/M/L/KA 以外の場合の汎用パッキング。
     * 重量と box_capacities だけを見て最小箱に順次詰める素朴な実装。
     * 将来的により最適なアルゴリズムに差し替え可能。
     */
    private function packBagsGeneric(int $speciesId, array $bags): array
    {
        $boxes = [];
        $remaining = $bags;

        while (array_sum($remaining) > 0) {
            $placed = false;
            foreach (self::BOX_SIZES as $boxSize) {
                $caps = $this->speciesMasters[$speciesId]['box_capacities'][$boxSize] ?? [];
                $box = array_fill_keys(array_keys($bags), 0);
                $anyPlaced = false;
                foreach ($remaining as $size => $count) {
                    $cap = $caps[$size] ?? 0;
                    $take = min($count, $cap);
                    if ($take <= 0) continue;
                    $box[$size] = $take;
                    if ($this->fitsInBoxGeneric($speciesId, $box, $boxSize)) {
                        $remaining[$size] -= $take;
                        $anyPlaced = true;
                    } else {
                        // 段階的に減らして収まる最大量を探す
                        while ($take > 0) {
                            $box[$size] = $take;
                            if ($this->fitsInBoxGeneric($speciesId, $box, $boxSize)) {
                                $remaining[$size] -= $take;
                                $anyPlaced = true;
                                break;
                            }
                            $take--;
                        }
                    }
                }
                if ($anyPlaced) {
                    $boxes[] = ['box_size' => $boxSize, 'bags' => array_filter($box, fn ($c) => $c > 0)];
                    $placed = true;
                    break;
                }
            }
            if (!$placed) {
                throw new \RuntimeException("袋を箱に詰められません（マスタ設定を確認してください）");
            }
        }

        return $boxes;
    }

    private function maxAdditionalStandard(int $speciesId, array $box, string $bag, int $boxSize, int $available): int
    {
        if ($available <= 0) return 0;
        $count = 0;
        while ($count < $available) {
            $trial = $box;
            $trial[$bag] = ($trial[$bag] ?? 0) + $count + 1;
            if (!$this->fitsInBox(
                $speciesId,
                $trial['S'] ?? 0, $trial['M'] ?? 0, $trial['L'] ?? 0, $trial['KA'] ?? 0,
                $boxSize
            )) {
                break;
            }
            $count++;
        }
        return $count;
    }

    /**
     * S/M/L/KA の 4 袋前提での収容判定（既存互換）。
     */
    private function fitsInBox(int $speciesId, int $s, int $m, int $l, int $ka, int $boxSize): bool
    {
        $bagSpecs = $this->speciesMasters[$speciesId]['bag_specs'];
        $weights = [
            'S' => (float) ($bagSpecs['S']['weight_kg'] ?? 0),
            'M' => (float) ($bagSpecs['M']['weight_kg'] ?? 0),
            'L' => (float) ($bagSpecs['L']['weight_kg'] ?? 0),
            'KA' => (float) ($bagSpecs['KA']['weight_kg'] ?? 0),
        ];
        $totalWeight = $s * $weights['S'] + $m * $weights['M'] + $l * $weights['L'] + $ka * $weights['KA'];

        $boxSpec = $this->boxSpecs[$boxSize] ?? null;
        if (!$boxSpec || $totalWeight > $boxSpec['max_weight_kg']) {
            return false;
        }

        $caps = $this->speciesMasters[$speciesId]['box_capacities'][$boxSize] ?? [];
        if ($s > ($caps['S'] ?? 0) || $m > ($caps['M'] ?? 0) ||
            $l > ($caps['L'] ?? 0) || $ka > ($caps['KA'] ?? 0)) {
            return false;
        }

        // 混載制約は DB 参照
        return $this->satisfiesMixRestrictions($speciesId, ['S' => $s, 'M' => $m, 'L' => $l, 'KA' => $ka], $boxSize);
    }

    private function fitsInBoxGeneric(int $speciesId, array $box, int $boxSize): bool
    {
        $bagSpecs = $this->speciesMasters[$speciesId]['bag_specs'];
        $totalWeight = 0.0;
        foreach ($box as $size => $count) {
            $totalWeight += $count * (float) ($bagSpecs[$size]['weight_kg'] ?? 0);
        }

        $boxSpec = $this->boxSpecs[$boxSize] ?? null;
        if (!$boxSpec || $totalWeight > $boxSpec['max_weight_kg']) {
            return false;
        }

        $caps = $this->speciesMasters[$speciesId]['box_capacities'][$boxSize] ?? [];
        foreach ($box as $size => $count) {
            if ($count > ($caps[$size] ?? 0)) {
                return false;
            }
        }

        return $this->satisfiesMixRestrictions($speciesId, $box, $boxSize);
    }

    /**
     * bag_mix_restrictions マスタを参照し、禁止ペアが同一箱に共存していないことを確認。
     */
    private function satisfiesMixRestrictions(int $speciesId, array $box, int $boxSize): bool
    {
        $restrictions = $this->speciesMasters[$speciesId]['mix_restrictions'] ?? [];
        foreach ($restrictions as $r) {
            if ($r['box_size'] !== null && $r['box_size'] !== $boxSize) continue;
            $a = $box[$r['bag_size_a']] ?? 0;
            $b = $box[$r['bag_size_b']] ?? 0;
            if ($a > 0 && $b > 0) {
                return false;
            }
        }
        return true;
    }

    // ══════════════════════════════════════════════════════════════
    // 内部: Manual / Mixed 結果ビルダ
    // ══════════════════════════════════════════════════════════════

    private function buildManualResult(array $grouped, string $destinationRegion): array
    {
        $breakdown = [];
        foreach ($grouped as $speciesId => $items) {
            $sp = $this->getSpecies($speciesId);
            $breakdown[] = [
                'species_type_id' => $speciesId,
                'species_code' => $sp->code,
                'species_name' => $sp->name,
                'calculation_mode' => $sp->calculation_mode,
                'quantity' => array_sum(array_map(fn ($i) => $i['quantity'], $items)),
                'subtotal_fee' => null,
            ];
        }

        return [
            'calculation_mode' => 'manual',
            'species_breakdown' => $breakdown,
            'bags' => [],
            'boxes' => [],
            'shipping_cost' => null,
            'packing_material_cost' => null,
            'total_shipping_fee' => null,
            'destination_region' => $destinationRegion,
            'manual_reason' => '「その他」種別を含むため、管理者が手動で送料を確定します。',
        ];
    }

    /**
     * 複数 auto 種別が混在するケース。現状は種別ごとに別箱で自動計算し合算する
     * （species.is_mixable を今後参照して同一箱への混載に拡張可能）。
     */
    private function buildMixedResult(array $grouped, string $destinationRegion): array
    {
        $totalShipping = 0;
        $totalPacking = 0;
        $allBoxes = [];
        $allBags = [];
        $breakdown = [];

        foreach ($grouped as $speciesId => $items) {
            $sub = $this->calculateForSpecies($speciesId, $items, $destinationRegion);
            $sp = $this->getSpecies($speciesId);
            foreach ($sub['boxes'] as $b) {
                $allBoxes[] = $b + ['species_code' => $sp->code, 'species_name' => $sp->name];
            }
            foreach ($sub['bags'] as $bg) {
                $allBags[] = $bg + ['species_code' => $sp->code];
            }
            $totalShipping += $sub['shipping_cost'];
            $totalPacking += $sub['packing_material_cost'];
            $breakdown[] = [
                'species_type_id' => $speciesId,
                'species_code' => $sp->code,
                'species_name' => $sp->name,
                'quantity' => array_sum(array_map(fn ($i) => $i['quantity'], $items)),
                'subtotal_fee' => $sub['total_shipping_fee'],
            ];
        }

        return [
            'calculation_mode' => 'mixed',
            'species_breakdown' => $breakdown,
            'bags' => $allBags,
            'boxes' => $allBoxes,
            'shipping_cost' => $totalShipping,
            'packing_material_cost' => $totalPacking,
            'total_shipping_fee' => $totalShipping + $totalPacking,
            'destination_region' => $destinationRegion,
        ];
    }

    // ══════════════════════════════════════════════════════════════
    // 内部: マスタ読み込み・グループ化
    // ══════════════════════════════════════════════════════════════

    /**
     * @param array $items
     * @return array<int, array<int, array>>  species_id => [items]
     */
    private function groupItemsBySpecies(array $items): array
    {
        $grouped = [];
        foreach ($items as $item) {
            $speciesId = $item['species_type_id'] ?? null;
            if (!$speciesId || !isset($this->speciesById[$speciesId])) {
                $speciesId = $this->defaultSpeciesId;
            }
            if ($speciesId === null) {
                throw new \RuntimeException('default species_type が定義されていません。');
            }
            $grouped[$speciesId][] = $item;
        }
        return $grouped;
    }

    private function getSpecies(int $speciesId): SpeciesType
    {
        if (!isset($this->speciesById[$speciesId])) {
            $species = SpeciesType::find($speciesId);
            if (!$species) {
                throw new \RuntimeException("species_type_id={$speciesId} が存在しません。");
            }
            $this->speciesById[$speciesId] = $species;
        }
        return $this->speciesById[$speciesId];
    }

    private function loadSpeciesIndex(): void
    {
        $rows = Cache::remember('shipping_species_index', self::CACHE_TTL, function () {
            return SpeciesType::all()->toArray();
        });
        foreach ($rows as $row) {
            $model = new SpeciesType();
            $model->forceFill($row);
            $model->exists = true;
            $this->speciesById[$row['id']] = $model;
            $this->speciesIdByCode[$row['code']] = $row['id'];
            if (!empty($row['is_default'])) {
                $this->defaultSpeciesId = $row['id'];
            }
        }
        // fallback: デフォルト未設定ならメダカを使う
        if ($this->defaultSpeciesId === null && isset($this->speciesIdByCode['medaka'])) {
            $this->defaultSpeciesId = $this->speciesIdByCode['medaka'];
        }
    }

    private function loadCommonMasters(): void
    {
        $this->boxSpecs = Cache::remember('shipping_box_specs', self::CACHE_TTL, function () {
            $specs = [];
            foreach (BoxSpec::all() as $box) {
                $specs[$box->box_size] = [
                    'max_weight_kg' => $box->max_weight_kg,
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

    private function loadSpeciesMasters(int $speciesId): void
    {
        if (isset($this->speciesMasters[$speciesId])) return;

        $bagSpecs = Cache::remember("shipping_bag_specs_species_{$speciesId}", self::CACHE_TTL, function () use ($speciesId) {
            $specs = [];
            foreach (BagSpec::where('species_type_id', $speciesId)->get() as $bag) {
                $specs[$bag->bag_size] = [
                    'min_qty' => (int) $bag->min_qty,
                    'max_qty' => $bag->max_qty !== null ? (int) $bag->max_qty : null,
                    'weight_kg' => (float) $bag->weight_kg,
                ];
            }
            return $specs;
        });

        $boxCapacities = Cache::remember("shipping_box_capacities_species_{$speciesId}", self::CACHE_TTL, function () use ($speciesId) {
            $caps = [];
            foreach (DB::table('box_capacities')->where('species_type_id', $speciesId)->get() as $row) {
                $caps[$row->box_size][$row->bag_size] = $row->max_count;
            }
            return $caps;
        });

        $mixRestrictions = Cache::remember("shipping_mix_restrictions_species_{$speciesId}", self::CACHE_TTL, function () use ($speciesId) {
            return DB::table('bag_mix_restrictions')
                ->where(function ($q) use ($speciesId) {
                    $q->where('species_type_id', $speciesId)
                      ->orWhereNull('species_type_id');
                })
                ->get()
                ->map(fn ($r) => [
                    'box_size' => $r->box_size !== null ? (int) $r->box_size : null,
                    'bag_size_a' => $r->bag_size_a,
                    'bag_size_b' => $r->bag_size_b,
                ])
                ->toArray();
        });

        $this->speciesMasters[$speciesId] = [
            'bag_specs' => $bagSpecs,
            'box_capacities' => $boxCapacities,
            'mix_restrictions' => $mixRestrictions,
        ];
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
        foreach ($bags as $size => $count) {
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
}
