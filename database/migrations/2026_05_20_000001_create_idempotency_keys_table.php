<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('idempotency_keys', function (Blueprint $table) {
            $table->id();
            $table->string('scope', 64)->comment('適用範囲。例: internal-upload');
            $table->string('idempotency_key', 128)->comment('クライアントが付与するキー（UUID推奨）');
            $table->char('request_hash', 64)->comment('リクエスト本文の SHA-256。同キーで異なるペイロードを拒否するため');
            $table->enum('status', ['processing', 'completed'])->comment('処理状態');
            $table->unsignedSmallInteger('response_status')->nullable()->comment('完了時の HTTP ステータス');
            $table->json('response_body')->nullable()->comment('完了時のレスポンス本文');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('completed_at')->nullable();

            $table->unique(['scope', 'idempotency_key'], 'uniq_scope_key');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('idempotency_keys');
    }
};
