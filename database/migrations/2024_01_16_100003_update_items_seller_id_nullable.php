<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * seller_id を NULLABLE に変更
     * Phase 1: NULL（管理者一括管理）
     * Phase 2: NOT NULL（出品者管理）
     */
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            // 既存の外部キー制約を一旦削除
            $table->dropForeign(['seller_id']);
            
            // NULL許可に変更
            $table->foreignId('seller_id')
                ->nullable()
                ->change()
                ->comment('出品者ID（Phase 1では NULL=管理者管理）');
            
            // 外部キー制約を再設定（ON DELETE SET NULL）
            $table->foreign('seller_id')
                ->references('id')
                ->on('sellers')
                ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropForeign(['seller_id']);
            
            $table->foreignId('seller_id')
                ->nullable(false)
                ->change();
            
            $table->foreign('seller_id')
                ->references('id')
                ->on('sellers')
                ->onDelete('restrict');
        });
    }
};
