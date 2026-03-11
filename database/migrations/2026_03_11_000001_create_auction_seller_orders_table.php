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
        Schema::create('auction_seller_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('auction_id')
                ->constrained('auctions')
                ->onDelete('cascade')
                ->comment('オークションID');
            $table->foreignId('seller_profile_id')
                ->constrained('seller_profiles')
                ->onDelete('cascade')
                ->comment('出品者プロファイルID');
            $table->integer('display_order')
                ->unsigned()
                ->default(0)
                ->comment('表示順序（小さいほど先）');
            $table->timestamps();

            // 同一オークション内で出品者は一意
            $table->unique(['auction_id', 'seller_profile_id']);
            
            // 表示順序でのソート用インデックス
            $table->index(['auction_id', 'display_order']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('auction_seller_orders');
    }
};
