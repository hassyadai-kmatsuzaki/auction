<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_campaign_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('email_campaign_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->string('email')->comment('送信時点のメアドをスナップショット保存。ユーザーがメアド変更しても履歴は残る');
            $table->enum('status', ['queued', 'sent', 'failed', 'bounced', 'complained', 'skipped'])
                  ->default('queued');
            $table->timestamp('sent_at')->nullable();
            $table->text('error')->nullable()->comment('failed/skipped 時の理由');
            $table->timestamps();

            $table->unique(['email_campaign_id', 'user_id']);
            $table->index(['email_campaign_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_campaign_recipients');
    }
};
