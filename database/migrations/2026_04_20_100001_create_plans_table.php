<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique()->comment('プラン識別コード (bid_only/sell_only/both など)');
            $table->string('name', 100)->comment('プラン名');
            $table->text('description')->nullable()->comment('説明');
            $table->unsignedInteger('amount')->comment('年会費（税込, 円）');
            $table->boolean('allows_bid')->default(false)->comment('落札（入札）権限');
            $table->boolean('allows_sell')->default(false)->comment('出品権限');
            $table->boolean('is_active')->default(true)->comment('新規加入可能か');
            $table->unsignedInteger('sort_order')->default(0)->comment('表示順');
            $table->timestamps();
            $table->softDeletes();

            $table->index('is_active', 'idx_plans_is_active');
            $table->index('sort_order', 'idx_plans_sort_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
