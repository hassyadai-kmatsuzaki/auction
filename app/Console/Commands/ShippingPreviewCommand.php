<?php

namespace App\Console\Commands;

use App\Services\ShippingCalculatorService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * 配送料金 v5 ロジックの動作確認用コマンド。
 *
 * 使い方:
 *   # 仕様書§6 の境界 11 例を一括検証（期待値と突き合わせ）
 *   php artisan shipping:preview
 *
 *   # 任意の出品構成で 1 回計算（匹数を空白区切りで渡す）
 *   php artisan shipping:preview 50 80
 *   php artisan shipping:preview 100 100 100 100 100 --region=九州
 *
 *   # 全 11 地域に対して 1 ケースを横並び表示
 *   php artisan shipping:preview 50 --all-regions
 */
class ShippingPreviewCommand extends Command
{
    protected $signature = 'shipping:preview
        {quantities?* : 出品ごとの匹数（指定なし → 仕様書§6 の11例を実行）}
        {--region=関東 : 配送先地域（北海道/東北/関東/信越/北陸/中部/関西/中国/四国/九州/沖縄）}
        {--species=medaka : 種別コード（medaka/aquatic_plant/goldfish/other）}
        {--all-regions : 11 地域すべての送料を横並び表示}
        {--fresh : 実行前にキャッシュをクリア}';

    protected $description = '配送料金 v5 ロジックのプレビュー計算（CLI から動作確認）';

    public function handle(): int
    {
        if ($this->option('fresh')) {
            ShippingCalculatorService::clearCache();
            Cache::flush();
            $this->info('キャッシュをクリアしました');
        }

        $speciesCode = $this->option('species');
        $speciesId = (int) DB::table('species_types')->where('code', $speciesCode)->value('id');
        if (!$speciesId) {
            $this->error("species code '{$speciesCode}' が species_types に存在しません");
            return 1;
        }

        $quantities = array_map('intval', $this->argument('quantities') ?: []);

        if (empty($quantities)) {
            return $this->runSpecCases($speciesId, $speciesCode);
        }

        if ($this->option('all-regions')) {
            return $this->runAllRegions($speciesId, $speciesCode, $quantities);
        }

        return $this->runSingle($speciesId, $speciesCode, $this->option('region'), $quantities);
    }

    private function runSingle(int $speciesId, string $speciesCode, string $region, array $quantities): int
    {
        $calc = new ShippingCalculatorService();
        $items = array_map(
            fn ($q) => ['quantity' => $q, 'species_type_id' => $speciesId],
            $quantities
        );

        try {
            $result = $calc->calculate($items, $region);
        } catch (\Throwable $e) {
            $this->error("計算失敗: {$e->getMessage()}");
            return 1;
        }

        $this->newLine();
        $this->line("配送先 : <info>{$region}</info>");
        $this->line("種別   : <info>{$speciesCode}</info>");
        $this->line("出品   : <info>" . implode(' / ', array_map(fn ($q) => "{$q}匹", $quantities)) . "</info>");
        $this->line("総匹数 : <info>" . array_sum($quantities) . "匹</info>");
        $this->newLine();

        if (($result['calculation_mode'] ?? null) === 'manual') {
            $this->warn('manual モード（その他種別を含むため自動計算なし）');
            return 0;
        }

        $bagsStr = collect($result['bags'] ?? [])
            ->map(fn ($b) => "{$b['size']}×{$b['quantity']}")
            ->implode(' ');
        $this->line("袋構成 : <info>{$bagsStr}</info>");
        $this->newLine();

        $rows = collect($result['boxes'] ?? [])->map(fn ($b) => [
            "{$b['box_size']}号",
            implode(' ', $b['bags']),
            '¥' . number_format($b['shipping_cost']),
            '¥' . number_format($b['packing_material_cost']),
            '¥' . number_format($b['shipping_cost'] + $b['packing_material_cost']),
        ])->all();
        $this->table(['箱', '袋', '送料', '梱包資材費', '小計'], $rows);

        $this->newLine();
        $this->line('  送料合計  : ¥' . number_format($result['shipping_cost']));
        $this->line('  資材費合計: ¥' . number_format($result['packing_material_cost']));
        $this->line('  ─────────────────');
        $this->line('  <fg=yellow>配送料金合計: ¥' . number_format($result['total_shipping_fee']) . '</>');
        $this->newLine();

        return 0;
    }

    private function runAllRegions(int $speciesId, string $speciesCode, array $quantities): int
    {
        $regions = ['北海道', '東北', '関東', '信越', '北陸', '中部', '関西', '中国', '四国', '九州', '沖縄'];
        $calc = new ShippingCalculatorService();

        $rows = [];
        foreach ($regions as $region) {
            $items = array_map(
                fn ($q) => ['quantity' => $q, 'species_type_id' => $speciesId],
                $quantities
            );
            try {
                $r = $calc->calculate($items, $region);
                $boxes = collect($r['boxes'] ?? [])->map(fn ($b) => $b['box_size'] . '号')->implode('+');
                $rows[] = [
                    $region,
                    $boxes,
                    '¥' . number_format($r['shipping_cost'] ?? 0),
                    '¥' . number_format($r['packing_material_cost'] ?? 0),
                    '¥' . number_format($r['total_shipping_fee'] ?? 0),
                ];
            } catch (\Throwable $e) {
                $rows[] = [$region, 'ERROR', '-', '-', $e->getMessage()];
            }
        }

        $this->line("種別: <info>{$speciesCode}</info> / 出品: <info>"
            . implode(' ', array_map(fn ($q) => "{$q}匹", $quantities)) . '</info>');
        $this->newLine();
        $this->table(['地域', '箱構成', '送料', '資材費', '合計'], $rows);
        return 0;
    }

    private function runSpecCases(int $speciesId, string $speciesCode): int
    {
        $cases = [
            ['#1',  '1出品 1匹',                  [1],                                 1004],
            ['#2',  '1出品 20匹 (Sレンジ上端)',   [20],                                1004],
            ['#3',  '1出品 50匹 (Mレンジ上端)',   [50],                                1004],
            ['#4',  '1出品 100匹 (80箱L単独特例)', [100],                              1004],
            ['#5',  '2出品 10+80 (S+L)',          [10, 80],                            1197],
            ['#6',  '2出品 15+30 (S+M)',          [15, 30],                            1197],
            ['#7',  '2出品 40+40 (M+M)',          [40, 40],                            1197],
            ['#8',  '5出品 100×5 (L×5)',          [100, 100, 100, 100, 100],           2774],
            ['#9',  '10出品 20×10 (S×10)',        array_fill(0, 10, 20),               1770],
            ['#10', '13出品 20×13 (S×13)',        array_fill(0, 13, 20),               1770],
            ['#11', '6出品×30 + 1出品×20 (140満杯)', [30, 30, 30, 30, 30, 30, 20],     1770],
        ];

        $calc = new ShippingCalculatorService();
        $rows = [];
        $allPass = true;

        foreach ($cases as [$no, $name, $qty, $expected]) {
            $items = array_map(
                fn ($q) => ['quantity' => $q, 'species_type_id' => $speciesId],
                $qty
            );
            try {
                $r = $calc->calculate($items, '関東');
                $actual = (int) $r['total_shipping_fee'];
                $boxes = collect($r['boxes'])->map(fn ($b) => $b['box_size'] . '号')->implode('+');
                $pass = $actual === $expected;
            } catch (\Throwable $e) {
                $actual = $e->getMessage();
                $boxes = '-';
                $pass = false;
            }
            if (!$pass) $allPass = false;

            $rows[] = [
                $no,
                $name,
                $boxes,
                '¥' . number_format($expected),
                is_int($actual) ? '¥' . number_format($actual) : (string) $actual,
                $pass ? '<fg=green>PASS</>' : '<fg=red>FAIL</>',
            ];
        }

        $this->info("仕様書 §6 境界テスト（種別: {$speciesCode} / 配送先: 関東）");
        $this->newLine();
        $this->table(['#', 'ケース', '箱構成', '期待', '実際', '判定'], $rows);
        $this->newLine();

        if ($allPass) {
            $this->info('全 11 例 PASS');
            return 0;
        }
        $this->error('FAIL あり。マスタデータ or 計算ロジックを確認してください。');
        return 1;
    }
}
