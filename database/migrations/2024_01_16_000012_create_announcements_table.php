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
        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            $table->string('title')->comment('タイトル');
            $table->text('content')->comment('本文');
            $table->enum('announcement_type', ['general', 'auction', 'system', 'maintenance'])
                ->default('general')
                ->comment('お知らせ種別');
            $table->enum('target_audience', ['all', 'participants', 'admins'])
                ->default('all')
                ->comment('対象者');
            $table->boolean('is_published')->default(false)->comment('公開フラグ');
            $table->timestamp('published_at')->nullable()->comment('公開日時');
            $table->timestamp('expires_at')->nullable()->comment('有効期限');
            $table->enum('priority', ['low', 'normal', 'high', 'urgent'])
                ->default('normal')
                ->comment('優先度');
            $table->boolean('is_pinned')->default(false)->comment('ピン留めフラグ');
            $table->foreignId('auction_id')
                ->nullable()
                ->constrained('auctions')
                ->onDelete('cascade')
                ->comment('関連オークションID');
            $table->foreignId('created_by')
                ->constrained('users')
                ->onDelete('restrict')
                ->comment('作成者ID');
            $table->timestamps();
            
            // インデックス
            $table->index(['is_published', 'published_at']);
            $table->index('expires_at');
            $table->index('announcement_type');
            $table->index('auction_id');
            $table->index(['is_published', 'published_at', 'expires_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('announcements');
    }
};
