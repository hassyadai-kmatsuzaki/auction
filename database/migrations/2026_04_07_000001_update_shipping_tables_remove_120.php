<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. box_specs から 120 サイズを削除
        DB::table('box_specs')->where('box_size', 120)->delete();

        // 2. shipping_rates から 120 サイズを削除
        DB::table('shipping_rates')->where('box_size', 120)->delete();

        // 3. packing_materials から 120 サイズを削除
        DB::table('packing_materials')->where('box_size', 120)->delete();

        // 4. bag_specs の LL を KA にリネーム（仕様書に合わせる）
        DB::table('bag_specs')->where('bag_size', 'LL')->update(['bag_size' => 'KA']);

        // 5. box_capacities テーブル（袋×箱の最大収容数）を作成
        Schema::create('box_capacities', function (Blueprint $table) {
            $table->id();
            $table->integer('box_size')->comment('箱サイズ');
            $table->string('bag_size', 5)->comment('袋サイズ');
            $table->unsignedTinyInteger('max_count')->comment('最大収容数');
            $table->timestamps();
            $table->unique(['box_size', 'bag_size']);
        });

        // box_capacities 初期データ
        //        S   M   L   KA
        // 80:    1   0   0   0
        // 100:   2   1   0   0
        // 140:   9   3   2   1
        $capacities = [
            ['box_size' => 80,  'bag_size' => 'S',  'max_count' => 1],
            ['box_size' => 80,  'bag_size' => 'M',  'max_count' => 0],
            ['box_size' => 80,  'bag_size' => 'L',  'max_count' => 0],
            ['box_size' => 80,  'bag_size' => 'KA', 'max_count' => 0],
            ['box_size' => 100, 'bag_size' => 'S',  'max_count' => 2],
            ['box_size' => 100, 'bag_size' => 'M',  'max_count' => 1],
            ['box_size' => 100, 'bag_size' => 'L',  'max_count' => 0],
            ['box_size' => 100, 'bag_size' => 'KA', 'max_count' => 0],
            ['box_size' => 140, 'bag_size' => 'S',  'max_count' => 9],
            ['box_size' => 140, 'bag_size' => 'M',  'max_count' => 3],
            ['box_size' => 140, 'bag_size' => 'L',  'max_count' => 2],
            ['box_size' => 140, 'bag_size' => 'KA', 'max_count' => 1],
        ];
        foreach ($capacities as &$c) {
            $c['created_at'] = now();
            $c['updated_at'] = now();
        }
        DB::table('box_capacities')->insert($capacities);

        // 6. won_items に送料計算ステータスカラム追加
        Schema::table('won_items', function (Blueprint $table) {
            $table->timestamp('shipping_calculated_at')->nullable()->after('shipping_breakdown')
                ->comment('送料計算日時');
        });

        // 既に shipping_fee > 0 のレコードは計算済みとみなす
        DB::table('won_items')
            ->where('shipping_fee', '>', 0)
            ->whereNull('shipping_calculated_at')
            ->update(['shipping_calculated_at' => now()]);
    }

    public function down(): void
    {
        Schema::table('won_items', function (Blueprint $table) {
            $table->dropColumn('shipping_calculated_at');
        });

        Schema::dropIfExists('box_capacities');

        // KA を LL に戻す
        DB::table('bag_specs')->where('bag_size', 'KA')->update(['bag_size' => 'LL']);

        // 120 サイズを復元
        DB::table('box_specs')->insert([
            'box_size' => 120, 'max_weight_kg' => 15, 'max_s' => 6, 'max_m' => 2, 'max_l' => 1, 'max_ll' => 0,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('packing_materials')->insert([
            'box_size' => 120, 'styrofoam_cost' => 350, 'bag_material_cost' => 50, 'coolant_cost' => 0, 'updated_at' => now(),
        ]);
        // shipping_rates の 120 は各地域分必要だが省略
    }
};
