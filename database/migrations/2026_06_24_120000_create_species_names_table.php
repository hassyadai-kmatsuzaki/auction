<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 品種名（生体名 = items.species_name）の候補マスタ。
     * 出品申込フォームでの入力補助（変換候補）に使う「サジェスト元」。
     * items.species_name は引き続き自由テキスト（FK では縛らない）。
     * 出品者は候補から選んでも、自由に編集してもよい。管理者はここを CRUD して候補を増減できる。
     */
    public function up(): void
    {
        Schema::create('species_names', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique()->comment('品種名（生体名）。例: 紅白ラメ、幹之フルボディ');
            $table->unsignedInteger('sort_order')->default(0)->comment('表示順（小さいほど先）');
            $table->boolean('is_active')->default(true)->comment('false=候補から除外（論理削除）');
            $table->timestamps();
        });

        // 既存 items.species_name の distinct を初期候補として投入（取りこぼし防止）。
        $names = DB::table('items')
            ->whereNotNull('species_name')
            ->where('species_name', '!=', '')
            ->distinct()
            ->orderBy('species_name')
            ->pluck('species_name');

        $now = now();
        $rows = [];
        $order = 0;
        foreach ($names as $name) {
            $rows[] = [
                'name' => $name,
                'sort_order' => $order++,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        if ($rows !== []) {
            // name は unique。重複が混ざっていても弾けるよう chunk 単位で insertOrIgnore。
            foreach (array_chunk($rows, 200) as $chunk) {
                DB::table('species_names')->insertOrIgnore($chunk);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('species_names');
    }
};
