<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * 価格変動の根拠とタイミングを記録
     * - items.current_price の更新は必ずこのテーブルと一緒に実行
     * - 整合性の「唯一の真実」
     */
    public function up(): void
    {
        Schema::create('price_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')
                ->constrained('items')
                ->onDelete('cascade')
                ->comment('生体ID');
            $table->decimal('old_price', 10, 2)->comment('変更前価格');
            $table->decimal('new_price', 10, 2)->comment('変更後価格');
            $table->enum('reason', [
                'auto_increment',      // 自動上昇（3秒経過、複数人参加）
                'manual_adjustment',   // 手動調整（管理者）
                'bid_accepted',        // 入札受付（初回参加）
                'item_start',          // 商品開始（開始価格設定）
                'item_sold'            // 落札確定
            ])->comment('変動理由');
            $table->integer('active_bidder_count')->unsigned()->default(0)->comment('変動時のアクティブ入札者数');
            $table->foreignId('triggered_by')
                ->nullable()
                ->constrained('users')
                ->onDelete('set null')
                ->comment('変動を引き起こしたユーザーID');
            $table->json('metadata')->nullable()->comment('追加情報（任意）');
            $table->timestamp('created_at')->useCurrent()->comment('変動日時');
            
            // インデックス
            $table->index(['item_id', 'created_at'], 'idx_price_events_item_created');
            $table->index('reason');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('price_events');
    }
};
