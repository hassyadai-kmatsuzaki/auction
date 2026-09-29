<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * GMOあおぞらネット銀行 OAuth トークンの永続化（環境ごとに1行）。
 *
 * access_token / refresh_token は Model 側の encrypted キャストで暗号化して保存する。
 * アクセストークンが失効すると入金明細通知（Webhook）も止まるため、expires_at を見て
 * gmo-aozora:refresh-token が失効前にリフレッシュする。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gmo_aozora_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('environment', 20)->unique()->comment('production / development');
            $table->text('access_token')->comment('暗号化済み');
            $table->text('refresh_token')->comment('暗号化済み');
            $table->string('scope', 255)->nullable()->comment('許諾されたスコープ（空白区切り）');
            $table->string('token_type', 20)->default('Bearer');
            $table->timestamp('expires_at')->nullable()->comment('access_token の失効日時');
            $table->timestamp('authorized_at')->nullable()->comment('認可コードで最初に取得した日時');
            $table->timestamp('refreshed_at')->nullable()->comment('最後にリフレッシュした日時');
            $table->text('last_error')->nullable()->comment('最後のリフレッシュ失敗内容');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gmo_aozora_tokens');
    }
};
