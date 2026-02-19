<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bid_limit_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->decimal('limit_price', 12, 2)->comment('上限価格（指値）');
            $table->boolean('is_triggered')->default(false)->comment('自動オフが発動したか');
            $table->timestamp('triggered_at')->nullable()->comment('発動日時');
            $table->timestamps();

            // 商品 × ユーザー で一意
            $table->unique(['item_id', 'user_id']);
            $table->index('item_id');
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bid_limit_prices');
    }
};
