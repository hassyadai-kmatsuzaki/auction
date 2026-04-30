<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_campaigns', function (Blueprint $table) {
            $table->id();
            $table->string('subject');
            $table->longText('body_markdown')->comment('Markdown 本文。CampaignMail でレンダリングされる');
            $table->enum('target_type', ['all', 'filter', 'manual'])
                  ->comment('all=承認済み全員 / filter=条件絞り込み / manual=手動選択 (個別送信は manual の n=1)');
            $table->json('target_filter')->nullable()->comment('target_type=filter のとき role/has_won/last_login_before などの条件');
            $table->json('target_user_ids')->nullable()->comment('target_type=manual のとき送信対象 user_id 配列');
            $table->enum('status', ['draft', 'queued', 'sending', 'sent', 'cancelled', 'failed'])
                  ->default('draft');
            $table->unsignedBigInteger('created_by')->comment('作成した管理者の user_id');
            $table->timestamp('scheduled_at')->nullable()->comment('予約送信の発射時刻。null=即時');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedInteger('total_recipients')->default(0);
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('created_by');
            $table->index('scheduled_at');
            $table->foreign('created_by')->references('id')->on('users')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_campaigns');
    }
};
