<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete()->comment('1ユーザー1サブスク');
            $table->foreignId('plan_id')->constrained()->restrictOnDelete();

            // Square 側識別子
            $table->string('square_customer_id', 100)->nullable()->comment('Square Customer ID');
            $table->string('square_card_id', 100)->nullable()->comment('Card on File ID');
            $table->string('card_brand', 30)->nullable()->comment('VISA/MASTER 等');
            $table->string('card_last4', 4)->nullable()->comment('カード末尾4桁');
            $table->string('card_exp_month', 2)->nullable();
            $table->string('card_exp_year', 4)->nullable();

            $table->enum('status', ['pending', 'active', 'past_due', 'canceled', 'suspended'])
                  ->default('pending')
                  ->comment('pending=未課金, active=有効, past_due=支払失敗, canceled=解約済, suspended=停止');
            $table->timestamp('current_period_start')->nullable()->comment('現在の課金期間の開始');
            $table->timestamp('current_period_end')->nullable()->comment('現在の課金期間の終了（次回更新日）');
            $table->timestamp('canceled_at')->nullable();
            $table->timestamp('suspended_at')->nullable();
            $table->string('suspended_reason', 255)->nullable();

            $table->timestamps();

            $table->index('status', 'idx_subscriptions_status');
            $table->index('current_period_end', 'idx_subscriptions_period_end');
            $table->index('square_customer_id', 'idx_subscriptions_customer_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};
