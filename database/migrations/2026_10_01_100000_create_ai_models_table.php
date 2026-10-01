<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 機械学習モデルの登録簿（F-053 ML基礎フレームワーク）
 * 学習したモデル本体（特徴量の変換規則と重み）・評価指標・版を保存し、is_active の1件を推論に使う。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_models', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50)->comment('用途: price など');
            $table->unsignedInteger('version')->comment('同じ name 内の通し番号');
            $table->string('algorithm', 50)->comment('ridge_regression など');
            $table->json('params')->nullable()->comment('ハイパーパラメータ');
            $table->json('metrics')->nullable()->comment('評価指標（検証データでの誤差・ベースライン比較）');
            $table->unsignedInteger('train_samples')->default(0);
            $table->unsignedInteger('test_samples')->default(0);
            $table->longText('artifact')->comment('特徴量変換と重みの JSON');
            $table->boolean('is_active')->default(false);
            $table->timestamp('trained_at')->nullable();
            $table->timestamps();

            $table->unique(['name', 'version']);
            $table->index(['name', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_models');
    }
};
