<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 生体名（items.species_name）ごとの「サムネ向き（上見/横見）」設定。
     * 品種マスタのような重い概念ではなく、生体名→撮影ビューの2列だけの軽量マッピング。
     * 未登録（この表に無い生体名）は items から導出して一覧/アラートする（収集テーブルは持たない）。
     */
    public function up(): void
    {
        Schema::create('species_thumbnail_views', function (Blueprint $table) {
            $table->id();
            $table->string('species_name')->unique()->comment('生体名。items.species_name と一致させる');
            $table->enum('thumbnail_view', ['top', 'side'])->comment('サムネに使う写真の向き。top=上見 / side=横見');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('species_thumbnail_views');
    }
};
