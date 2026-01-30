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
            $table->string('title', 200)->comment('タイトル');
            $table->text('content')->comment('本文');
            $table->enum('status', ['draft', 'scheduled', 'published', 'hidden'])
                  ->default('draft')
                  ->comment('ステータス: draft=下書き, scheduled=公開予約, published=公開中, hidden=非表示');
            $table->json('target_roles')->comment('対象ロール（配列）');
            $table->boolean('is_important')->default(false)->comment('重要フラグ');
            $table->timestamp('published_at')->nullable()->comment('公開日時');
            
            // 作成・更新・削除者情報
            $table->foreignId('created_by')->constrained('users')->comment('作成者ID');
            $table->foreignId('updated_by')->nullable()->constrained('users')->comment('更新者ID');
            $table->timestamp('deleted_at')->nullable()->comment('削除日時');
            $table->foreignId('deleted_by')->nullable()->constrained('users')->comment('削除者ID');
            
            $table->timestamps();
            
            // インデックス
            $table->index('status', 'idx_status');
            $table->index('published_at', 'idx_published_at');
            $table->index('created_by', 'idx_created_by');
            $table->index('deleted_at', 'idx_deleted_at');
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
