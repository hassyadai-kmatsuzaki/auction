<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 配送料金 v5 仕様適用。
 *
 * 1) bag_specs に pack_unit カラム追加（S=1 / M=2 / L=3 単位）
 * 2) box_specs に unit_capacity / allow_single_l_override カラム追加
 * 3) auto 種別の bag_specs / box_specs / shipping_rates / packing_materials を v5 値に更新
 * 4) auto 種別の KA 袋は v5 で不要（1出品 ≤ 100匹保証）のため削除
 *
 * 既存テーブル box_capacities / bag_mix_restrictions は残存（v5 ロジックでは参照しない）。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bag_specs', function (Blueprint $table) {
            $table->unsignedTinyInteger('pack_unit')->nullable()->after('weight_kg')
                ->comment('v5: 1袋あたりの単位数（S=1 / M=2 / L=3）。null は v5 未対応種別');
        });

        Schema::table('box_specs', function (Blueprint $table) {
            $table->unsignedTinyInteger('unit_capacity')->nullable()->after('max_weight_kg')
                ->comment('v5: 箱の単位上限（80=2 / 100=7 / 140=13）');
            $table->boolean('allow_single_l_override')->default(false)->after('unit_capacity')
                ->comment('v5: L×1単独時に単位上限を超えてもよい（80箱のみ true）');
        });

        // box_specs を v5 値に更新（120 は既に削除済み）
        DB::table('box_specs')->where('box_size', 80)->update([
            'max_weight_kg' => 5,
            'unit_capacity' => 2,
            'allow_single_l_override' => true,
            'updated_at' => now(),
        ]);
        DB::table('box_specs')->where('box_size', 100)->update([
            'max_weight_kg' => 10,
            'unit_capacity' => 7,
            'allow_single_l_override' => false,
            'updated_at' => now(),
        ]);
        DB::table('box_specs')->where('box_size', 140)->update([
            'max_weight_kg' => 20,
            'unit_capacity' => 13,
            'allow_single_l_override' => false,
            'updated_at' => now(),
        ]);

        // packing_materials を v5 値に更新（合計 80=300 / 100=350 / 140=450）
        DB::table('packing_materials')->where('box_size', 80)->update([
            'styrofoam_cost' => 250, 'bag_material_cost' => 50, 'coolant_cost' => 0,
            'updated_at' => now(),
        ]);
        DB::table('packing_materials')->where('box_size', 100)->update([
            'styrofoam_cost' => 300, 'bag_material_cost' => 50, 'coolant_cost' => 0,
            'updated_at' => now(),
        ]);
        DB::table('packing_materials')->where('box_size', 140)->update([
            'styrofoam_cost' => 400, 'bag_material_cost' => 50, 'coolant_cost' => 0,
            'updated_at' => now(),
        ]);

        // shipping_rates を v5 マトリクスに更新（120 は既に削除済み）
        $regions = [
            '北海道' => [80 => 1298, 100 => 1628, 140 => 2288],
            '東北'   => [80 => 814,  100 => 957,  140 => 1430],
            '関東'   => [80 => 704,  100 => 847,  140 => 1320],
            '信越'   => [80 => 704,  100 => 847,  140 => 1320],
            '北陸'   => [80 => 704,  100 => 847,  140 => 1320],
            '中部'   => [80 => 704,  100 => 847,  140 => 1320],
            '関西'   => [80 => 814,  100 => 957,  140 => 1430],
            '中国'   => [80 => 924,  100 => 1067, 140 => 1540],
            '四国'   => [80 => 924,  100 => 1067, 140 => 1540],
            '九州'   => [80 => 1034, 100 => 1177, 140 => 1650],
            '沖縄'   => [80 => 1573, 100 => 1903, 140 => 2563],
        ];
        foreach ($regions as $region => $rates) {
            foreach ($rates as $boxSize => $rate) {
                DB::table('shipping_rates')
                    ->updateOrInsert(
                        ['region' => $region, 'box_size' => $boxSize],
                        ['rate' => $rate, 'updated_at' => now()]
                    );
            }
        }

        // auto 種別の袋マスタを v5 仕様で再構築
        $autoSpeciesIds = DB::table('species_types')
            ->where('calculation_mode', 'auto')
            ->pluck('id')
            ->all();

        foreach ($autoSpeciesIds as $speciesId) {
            // 既存袋を全削除して v5 構成（S/M/L のみ）で再投入
            DB::table('bag_specs')->where('species_type_id', $speciesId)->delete();
            DB::table('bag_specs')->insert([
                [
                    'species_type_id' => $speciesId, 'bag_size' => 'S',
                    'model' => 'R-18', 'min_qty' => 1,  'max_qty' => 20,  'weight_kg' => 1.5, 'pack_unit' => 1,
                    'created_at' => now(), 'updated_at' => now(),
                ],
                [
                    'species_type_id' => $speciesId, 'bag_size' => 'M',
                    'model' => 'R-27', 'min_qty' => 21, 'max_qty' => 50,  'weight_kg' => 2.0, 'pack_unit' => 2,
                    'created_at' => now(), 'updated_at' => now(),
                ],
                [
                    'species_type_id' => $speciesId, 'bag_size' => 'L',
                    'model' => 'R-30', 'min_qty' => 51, 'max_qty' => 100, 'weight_kg' => 4.5, 'pack_unit' => 3,
                    'created_at' => now(), 'updated_at' => now(),
                ],
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('box_specs', function (Blueprint $table) {
            $table->dropColumn(['unit_capacity', 'allow_single_l_override']);
        });

        Schema::table('bag_specs', function (Blueprint $table) {
            $table->dropColumn('pack_unit');
        });
        // 注: 旧 S/M/L/KA レンジへの巻き戻しは行わない（運用上の戻し作業として別途実施）
    }
};
