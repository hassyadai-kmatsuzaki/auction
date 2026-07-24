<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * E-NE（Cal-Connect）CRM 更新 API への送信ログ。
 *
 * 送信は notify キューの Job で非同期に行うため、この行が「送信キュー兼監査ログ」を兼ねる。
 * 管理画面から結果の確認と手動再送ができる。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ene_crm_requests', function (Blueprint $table) {
            $table->id();
            $table->string('event', 50)->comment('password_set / subscription_paid / bank_transfer_requested');
            $table->foreignId('user_id')->nullable()->comment('送信対象の users.id')
                ->constrained('users')->nullOnDelete();
            $table->string('line_user_id', 64)->nullable()->comment('E-NE CRM APIのキー。解決できなかった場合は null で skipped');
            $table->json('fields')->nullable()->comment('送信した fields（プレースホルダ展開後）');
            $table->boolean('trigger_automation')->default(false)->comment('E-NE側の副作用（ステップ配信等）を発火させるか');
            $table->string('status', 20)->default('pending')->comment('pending / success / failed / skipped');
            $table->unsignedSmallInteger('http_status')->nullable();
            $table->text('response')->nullable()->comment('レスポンス本文（先頭のみ）');
            $table->text('error')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['event', 'status']);
            $table->index('user_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ene_crm_requests');
    }
};
