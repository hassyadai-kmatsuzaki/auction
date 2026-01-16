<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * 入札参加状態を管理（リアルタイム更新）
     * - ONボタン：is_active = TRUE
     * - OFFボタン：is_active = FALSE
     */
    public function up(): void
    {
        Schema::create('bid_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')
                ->constrained('items')
                ->onDelete('cascade')
                ->comment('生体ID');
            $table->foreignId('user_id')
                ->constrained('users')
                ->onDelete('cascade')
                ->comment('ユーザーID');
            $table->boolean('is_active')->default(true)->comment('入札参加中フラグ');
            $table->timestamp('activated_at')->useCurrent()->comment('参加開始日時');
            $table->timestamp('deactivated_at')->nullable()->comment('参加終了日時');
            $table->string('ip_address', 45)->nullable()->comment('IPアドレス');
            $table->text('user_agent')->nullable()->comment('ユーザーエージェント');
            $table->timestamps();
            
            // インデックス・制約
            $table->unique(['item_id', 'user_id'], 'uk_item_user');
            $table->index(['item_id', 'is_active'], 'idx_item_active');
            $table->index('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bid_participants');
    }
};
