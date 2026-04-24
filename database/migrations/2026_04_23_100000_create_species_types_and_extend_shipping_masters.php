<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. 種別マスタ
        Schema::create('species_types', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique()->comment('medaka/aquatic_plant/goldfish/other 等');
            $table->string('name', 64);
            $table->enum('calculation_mode', ['auto', 'manual'])->default('auto');
            $table->boolean('is_mixable')->default(false)
                ->comment('他 auto 種別と同一箱への混載可否');
            $table->boolean('is_default')->default(false)
                ->comment('出品フォームの初期値（全体で 1 件のみ）');
            $table->json('allowed_quantity_units')
                ->comment('許容する quantity_unit の配列。例: ["fish"], ["fish","kg","bag"]');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // MySQL で is_default = true が複数存在しないための partial unique。
        // DB エンジン差分を避けるためアプリ層でも担保するが、MySQL 8.0+ の
        // functional index で false を除外する。
        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                'CREATE UNIQUE INDEX species_types_is_default_unique ON species_types ((CASE WHEN is_default = 1 THEN 1 ELSE NULL END))'
            );
        }

        // 2. 初期シード
        $now = now();
        DB::table('species_types')->insert([
            [
                'code' => 'medaka', 'name' => 'メダカ', 'calculation_mode' => 'auto',
                'is_mixable' => false, 'is_default' => true,
                'allowed_quantity_units' => json_encode(['fish']),
                'sort_order' => 1, 'is_active' => true,
                'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'code' => 'aquatic_plant', 'name' => '水草', 'calculation_mode' => 'auto',
                'is_mixable' => false, 'is_default' => false,
                'allowed_quantity_units' => json_encode(['fish']),
                'sort_order' => 2, 'is_active' => false, // マスタ投入後に有効化
                'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'code' => 'goldfish', 'name' => '金魚', 'calculation_mode' => 'auto',
                'is_mixable' => false, 'is_default' => false,
                'allowed_quantity_units' => json_encode(['fish']),
                'sort_order' => 3, 'is_active' => false,
                'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'code' => 'other', 'name' => 'その他', 'calculation_mode' => 'manual',
                'is_mixable' => false, 'is_default' => false,
                'allowed_quantity_units' => json_encode(['fish', 'kg', 'bag']),
                'sort_order' => 99, 'is_active' => true,
                'created_at' => $now, 'updated_at' => $now,
            ],
        ]);

        $medakaId = (int) DB::table('species_types')->where('code', 'medaka')->value('id');

        // 3. 混載制約マスタ（ShippingCalculatorService::fitsInBox のハードコードを外出し）
        Schema::create('bag_mix_restrictions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('species_type_id')->nullable()
                ->constrained('species_types')->cascadeOnDelete()
                ->comment('null なら全種別共通');
            $table->integer('box_size')->nullable()
                ->comment('null なら全箱サイズ対象');
            $table->string('bag_size_a', 8);
            $table->string('bag_size_b', 8);
            $table->timestamps();
            $table->index(['species_type_id', 'box_size']);
        });

        // 既存メダカのハードコードルールを移行
        DB::table('bag_mix_restrictions')->insert([
            [
                'species_type_id' => $medakaId, 'box_size' => 100,
                'bag_size_a' => 'S', 'bag_size_b' => 'M',
                'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'species_type_id' => $medakaId, 'box_size' => null,
                'bag_size_a' => 'KA', 'bag_size_b' => 'M',
                'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'species_type_id' => $medakaId, 'box_size' => null,
                'bag_size_a' => 'KA', 'bag_size_b' => 'L',
                'created_at' => $now, 'updated_at' => $now,
            ],
        ]);

        // 4. bag_specs に species_type_id を追加
        Schema::table('bag_specs', function (Blueprint $table) use ($medakaId) {
            $table->foreignId('species_type_id')->nullable()->after('id')
                ->constrained('species_types')->cascadeOnDelete();
        });
        DB::table('bag_specs')->whereNull('species_type_id')->update(['species_type_id' => $medakaId]);
        Schema::table('bag_specs', function (Blueprint $table) {
            $table->dropUnique(['bag_size']); // 旧 unique 破棄
            $table->unique(['species_type_id', 'bag_size']);
            // NOT NULL 化（バックフィル済みなので安全）
            $table->foreignId('species_type_id')->nullable(false)->change();
        });

        // 5. box_capacities に species_type_id を追加
        Schema::table('box_capacities', function (Blueprint $table) use ($medakaId) {
            $table->foreignId('species_type_id')->nullable()->after('id')
                ->constrained('species_types')->cascadeOnDelete();
        });
        DB::table('box_capacities')->whereNull('species_type_id')->update(['species_type_id' => $medakaId]);
        Schema::table('box_capacities', function (Blueprint $table) {
            $table->dropUnique(['box_size', 'bag_size']);
            $table->unique(['species_type_id', 'box_size', 'bag_size']);
            $table->foreignId('species_type_id')->nullable(false)->change();
        });

        // 6. items に species_type_id を追加（既存は全件メダカにバックフィル）
        Schema::table('items', function (Blueprint $table) {
            $table->foreignId('species_type_id')->nullable()->after('species_name')
                ->constrained('species_types')->nullOnDelete();
            $table->index('species_type_id');
        });
        DB::table('items')->whereNull('species_type_id')->update(['species_type_id' => $medakaId]);

        // 7. won_items に calculation_mode（監査・履歴用）を追加
        Schema::table('won_items', function (Blueprint $table) {
            $table->enum('calculation_mode', ['auto', 'manual', 'mixed'])
                ->nullable()->after('shipping_breakdown')
                ->comment('送料計算時の戦略（監査用）');
        });
    }

    public function down(): void
    {
        Schema::table('won_items', function (Blueprint $table) {
            $table->dropColumn('calculation_mode');
        });

        Schema::table('items', function (Blueprint $table) {
            $table->dropForeign(['species_type_id']);
            $table->dropColumn('species_type_id');
        });

        Schema::table('box_capacities', function (Blueprint $table) {
            $table->dropUnique(['species_type_id', 'box_size', 'bag_size']);
            $table->dropForeign(['species_type_id']);
            $table->dropColumn('species_type_id');
            $table->unique(['box_size', 'bag_size']);
        });

        Schema::table('bag_specs', function (Blueprint $table) {
            $table->dropUnique(['species_type_id', 'bag_size']);
            $table->dropForeign(['species_type_id']);
            $table->dropColumn('species_type_id');
            $table->unique(['bag_size']);
        });

        Schema::dropIfExists('bag_mix_restrictions');

        if (DB::getDriverName() === 'mysql') {
            DB::statement('DROP INDEX species_types_is_default_unique ON species_types');
        }

        Schema::dropIfExists('species_types');
    }
};
