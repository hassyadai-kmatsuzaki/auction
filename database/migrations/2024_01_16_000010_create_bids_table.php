<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('bids', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')
                ->constrained('items')
                ->onDelete('cascade')
                ->comment('生体ID');
            $table->foreignId('bidder_id')
                ->constrained('users')
                ->onDelete('cascade')
                ->comment('入札者ID');
            $table->decimal('bid_price', 10, 2)->comment('入札価格(1匹)');
            $table->decimal('total_amount', 10, 2)->comment('合計金額(価格×匹数)');
            $table->boolean('is_active')->default(true)->comment('アクティブフラグ(ON/OFF)');
            $table->enum('bid_type', ['manual', 'auto'])
                ->default('manual')
                ->comment('入札タイプ');
            $table->string('ip_address', 45)->nullable()->comment('IPアドレス');
            $table->text('user_agent')->nullable()->comment('ユーザーエージェント');
            $table->timestamps();
            
            // インデックス
            $table->index(['item_id', 'is_active', 'created_at']);
            $table->index(['item_id', 'created_at']);
            $table->index('bidder_id');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bids');
    }
};
