<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * GMOあおぞら Webhook の x-access-token 検証用に、リフレッシュ直前のアクセストークンを保持する。
 *
 * 入金明細通知には「通知対象ユーザーに発行されたアクセストークン」が付く。リフレッシュ直後は
 * 旧トークンで送られた通知（GMO の再送は最大1時間）が届き得るので、猶予期間だけ旧トークンも受け付ける。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gmo_aozora_tokens', function (Blueprint $table) {
            $table->text('previous_access_token')->nullable()->after('refresh_token')->comment('暗号化済み。リフレッシュ直前の access_token');
            $table->timestamp('previous_token_valid_until')->nullable()->after('previous_access_token')->comment('旧トークンを Webhook 検証で受け付ける期限');
        });
    }

    public function down(): void
    {
        Schema::table('gmo_aozora_tokens', function (Blueprint $table) {
            $table->dropColumn(['previous_access_token', 'previous_token_valid_until']);
        });
    }
};
