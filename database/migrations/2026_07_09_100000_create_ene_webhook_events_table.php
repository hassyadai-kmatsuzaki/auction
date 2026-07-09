<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * E-NE（Cal-Connect）外部連携 Webhook の受信ログ兼冪等テーブル。
 *
 * E-NE は 429/5xx/タイムアウト時に最大5回再送し、管理画面から手動再送もある。
 * 同一 delivery_id が複数回届く前提で、unique 制約で二重処理を防ぐ。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ene_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('delivery_id', 64)->unique()->comment('X-ENE-Delivery / payload.delivery_id（冪等キー, 通常UUID）');
            $table->string('event', 50)->default('unknown')->comment('crm_workflow.triggered / webhook.test 等');
            $table->unsignedBigInteger('customer_ene_id')->nullable()->comment('E-NE顧客番号（突合用）');
            $table->longText('payload')->comment('受信生ボディ');
            $table->foreignId('created_user_id')->nullable()->comment('作成した users.id')
                ->constrained('users')->nullOnDelete();
            $table->string('result', 30)->nullable()->comment('created / promoted / skipped / failed');
            $table->timestamp('received_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->text('processing_error')->nullable();
            $table->timestamps();

            $table->index('event');
            $table->index('result');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ene_webhook_events');
    }
};
