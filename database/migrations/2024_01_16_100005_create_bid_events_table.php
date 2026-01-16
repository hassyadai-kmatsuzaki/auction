<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * すべての入札関連イベントを不変の履歴として記録
     * - 追記のみ（更新・削除なし）
     * - 監査・トラブル対応・不正検知に使用
     */
    public function up(): void
    {
        Schema::create('bid_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')
                ->constrained('items')
                ->onDelete('cascade')
                ->comment('生体ID');
            $table->foreignId('user_id')
                ->constrained('users')
                ->onDelete('cascade')
                ->comment('ユーザーID');
            $table->enum('event_type', [
                'join',           // 入札参加（ONボタン）
                'leave',          // 入札離脱（OFFボタン）
                'price_accept',   // 価格上昇を受け入れ
                'auto_raise',     // 自動価格上昇
                'manual_raise',   // 手動価格上昇
                'win',           // 落札
                'lose'           // 落札失敗
            ])->comment('イベント種別');
            $table->decimal('price_at_event', 10, 2)->nullable()->comment('イベント時の価格');
            $table->json('metadata')->nullable()->comment('追加情報（任意）');
            $table->string('ip_address', 45)->nullable()->comment('IPアドレス');
            $table->text('user_agent')->nullable()->comment('ユーザーエージェント');
            $table->timestamp('created_at')->useCurrent()->comment('イベント発生日時');
            
            // インデックス
            $table->index(['item_id', 'created_at'], 'idx_bid_events_item_created');
            $table->index('user_id');
            $table->index('event_type');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bid_events');
    }
};
