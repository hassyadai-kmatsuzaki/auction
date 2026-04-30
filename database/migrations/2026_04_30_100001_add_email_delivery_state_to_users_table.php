<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('email_bounced_at')
                  ->nullable()
                  ->after('email_verified_at')
                  ->comment('SES でハードバウンスを記録した日時。以降の配信から除外');
            $table->timestamp('email_complained_at')
                  ->nullable()
                  ->after('email_bounced_at')
                  ->comment('SES で苦情(spam報告)を記録した日時。以降の配信から除外');
            $table->timestamp('email_opt_out_at')
                  ->nullable()
                  ->after('email_complained_at')
                  ->comment('ユーザー自身が配信停止した日時。トランザクションメールは送る');
            $table->string('unsubscribe_token', 64)
                  ->nullable()
                  ->unique()
                  ->after('email_opt_out_at')
                  ->comment('配信停止リンク用の不可逆トークン');
        });

        // 既存ユーザー全員に unsubscribe_token を発行
        DB::table('users')->whereNull('unsubscribe_token')->orderBy('id')->chunkById(500, function ($users) {
            foreach ($users as $user) {
                DB::table('users')
                    ->where('id', $user->id)
                    ->update(['unsubscribe_token' => Str::random(48)]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['unsubscribe_token']);
            $table->dropColumn([
                'email_bounced_at',
                'email_complained_at',
                'email_opt_out_at',
                'unsubscribe_token',
            ]);
        });
    }
};
