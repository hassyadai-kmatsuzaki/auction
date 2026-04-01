<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 袋サイズマスタ
        Schema::create('bag_specs', function (Blueprint $table) {
            $table->id();
            $table->string('bag_size', 5)->unique()->comment('S/M/L/LL');
            $table->string('model', 10)->nullable()->comment('袋品番（r-17等）');
            $table->integer('min_qty')->comment('最小匹数');
            $table->integer('max_qty')->nullable()->comment('最大匹数（LLはNULL=上限なし）');
            $table->decimal('weight_kg', 4, 1)->comment('袋重量(kg)');
            $table->timestamps();
        });

        // 箱サイズマスタ
        Schema::create('box_specs', function (Blueprint $table) {
            $table->id();
            $table->integer('box_size')->unique()->comment('箱サイズ（80/100/120/140）');
            $table->integer('max_weight_kg')->comment('重量上限(kg)');
            $table->integer('max_s')->comment('S袋最大数');
            $table->integer('max_m')->comment('M袋最大数');
            $table->integer('max_l')->comment('L袋最大数');
            $table->integer('max_ll')->comment('LL袋最大数');
            $table->timestamps();
        });

        // ヤマト法人送料テーブル（地域×箱サイズ）
        Schema::create('shipping_rates', function (Blueprint $table) {
            $table->id();
            $table->string('region', 10)->comment('配送先地域（北海道/東北/関東/...）');
            $table->integer('box_size')->comment('箱サイズ（80/100/120/140）');
            $table->integer('rate')->comment('税込送料（円）');
            $table->timestamp('updated_at')->useCurrent();
            $table->unique(['region', 'box_size']);
        });

        // 梱包資材費テーブル（箱サイズ別）
        Schema::create('packing_materials', function (Blueprint $table) {
            $table->id();
            $table->integer('box_size')->unique()->comment('箱サイズ');
            $table->integer('styrofoam_cost')->comment('発泡スチロール（円）');
            $table->integer('bag_material_cost')->comment('袋資材費（円）');
            $table->integer('coolant_cost')->default(0)->comment('保冷剤（円）※現在0');
            $table->timestamp('updated_at')->useCurrent();
        });

        // won_items に配送料金カラムを追加
        Schema::table('won_items', function (Blueprint $table) {
            $table->integer('shipping_fee')->default(0)->after('seller_amount')->comment('配送料金（送料+梱包資材費）');
            $table->json('shipping_breakdown')->nullable()->after('shipping_fee')->comment('配送料金内訳JSON');
        });

        // 初期データ投入
        $this->seedBagSpecs();
        $this->seedBoxSpecs();
        $this->seedShippingRates();
        $this->seedPackingMaterials();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('won_items', function (Blueprint $table) {
            $table->dropColumn(['shipping_fee', 'shipping_breakdown']);
        });
        Schema::dropIfExists('packing_materials');
        Schema::dropIfExists('shipping_rates');
        Schema::dropIfExists('box_specs');
        Schema::dropIfExists('bag_specs');
    }

    private function seedBagSpecs(): void
    {
        DB::table('bag_specs')->insert([
            ['bag_size' => 'S',  'model' => 'r-17', 'min_qty' => 1,   'max_qty' => 30,   'weight_kg' => 2.2, 'created_at' => now(), 'updated_at' => now()],
            ['bag_size' => 'M',  'model' => 'r-38', 'min_qty' => 31,  'max_qty' => 200,  'weight_kg' => 5.5, 'created_at' => now(), 'updated_at' => now()],
            ['bag_size' => 'L',  'model' => 'r-48', 'min_qty' => 201, 'max_qty' => 500,  'weight_kg' => 8.0, 'created_at' => now(), 'updated_at' => now()],
            ['bag_size' => 'LL', 'model' => 'KA-1', 'min_qty' => 501, 'max_qty' => null,  'weight_kg' => 15.0, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    private function seedBoxSpecs(): void
    {
        DB::table('box_specs')->insert([
            ['box_size' => 80,  'max_weight_kg' => 5,  'max_s' => 1, 'max_m' => 0, 'max_l' => 0, 'max_ll' => 0, 'created_at' => now(), 'updated_at' => now()],
            ['box_size' => 100, 'max_weight_kg' => 10, 'max_s' => 2, 'max_m' => 1, 'max_l' => 0, 'max_ll' => 0, 'created_at' => now(), 'updated_at' => now()],
            ['box_size' => 120, 'max_weight_kg' => 15, 'max_s' => 6, 'max_m' => 2, 'max_l' => 1, 'max_ll' => 0, 'created_at' => now(), 'updated_at' => now()],
            ['box_size' => 140, 'max_weight_kg' => 20, 'max_s' => 9, 'max_m' => 3, 'max_l' => 2, 'max_ll' => 1, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    private function seedShippingRates(): void
    {
        $regions = [
            '北海道' => [80 => 1298, 100 => 1628, 120 => 1958, 140 => 2288],
            '東北'   => [80 => 814,  100 => 957,  120 => 1133, 140 => 1430],
            '関東'   => [80 => 704,  100 => 847,  120 => 1023, 140 => 1320],
            '信越'   => [80 => 704,  100 => 847,  120 => 1023, 140 => 1320],
            '北陸'   => [80 => 704,  100 => 847,  120 => 1023, 140 => 1320],
            '中部'   => [80 => 704,  100 => 847,  120 => 1023, 140 => 1320],
            '関西'   => [80 => 814,  100 => 957,  120 => 1133, 140 => 1430],
            '中国'   => [80 => 924,  100 => 1067, 120 => 1243, 140 => 1540],
            '四国'   => [80 => 924,  100 => 1067, 120 => 1243, 140 => 1540],
            '九州'   => [80 => 1034, 100 => 1177, 120 => 1353, 140 => 1650],
            '沖縄'   => [80 => 1573, 100 => 1903, 120 => 2233, 140 => 2563],
        ];

        $rows = [];
        foreach ($regions as $region => $rates) {
            foreach ($rates as $boxSize => $rate) {
                $rows[] = [
                    'region' => $region,
                    'box_size' => $boxSize,
                    'rate' => $rate,
                    'updated_at' => now(),
                ];
            }
        }
        DB::table('shipping_rates')->insert($rows);
    }

    private function seedPackingMaterials(): void
    {
        DB::table('packing_materials')->insert([
            ['box_size' => 80,  'styrofoam_cost' => 250, 'bag_material_cost' => 50, 'coolant_cost' => 0, 'updated_at' => now()],
            ['box_size' => 100, 'styrofoam_cost' => 300, 'bag_material_cost' => 50, 'coolant_cost' => 0, 'updated_at' => now()],
            ['box_size' => 120, 'styrofoam_cost' => 350, 'bag_material_cost' => 50, 'coolant_cost' => 0, 'updated_at' => now()],
            ['box_size' => 140, 'styrofoam_cost' => 400, 'bag_material_cost' => 50, 'coolant_cost' => 0, 'updated_at' => now()],
        ]);
    }
};
