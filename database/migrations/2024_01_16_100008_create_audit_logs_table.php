<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * 重要な操作を記録（監査・トラブル対応・不正検知）
     */
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->onDelete('set null')
                ->comment('操作ユーザーID');
            $table->string('action', 100)->comment('操作種別');
            $table->string('auditable_type', 100)->comment('対象モデル');
            $table->bigInteger('auditable_id')->unsigned()->nullable()->comment('対象レコードID');
            $table->json('old_values')->nullable()->comment('変更前の値');
            $table->json('new_values')->nullable()->comment('変更後の値');
            $table->string('ip_address', 45)->nullable()->comment('IPアドレス');
            $table->text('user_agent')->nullable()->comment('ユーザーエージェント');
            $table->timestamp('created_at')->useCurrent()->comment('操作日時');
            
            // インデックス
            $table->index('user_id');
            $table->index('action');
            $table->index(['auditable_type', 'auditable_id'], 'idx_auditable');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
