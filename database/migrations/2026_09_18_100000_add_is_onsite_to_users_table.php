<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 当日会員（会場で電話番号＋パスワードだけで登録する会員）のフラグ。
 *
 * - ログイン識別子の切替（電話番号ログインは is_onsite=true のみ対象）
 * - フロントの必須ゲート（配送先住所 / LINE 連携勧誘）のスキップ
 * - 管理画面の絞り込み
 * の判定に使う。メール通知の遮断はメールアドレスのドメイン（User::ONSITE_EMAIL_DOMAIN）で行う。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_onsite')->default(false)->after('is_test')
                ->comment('当日会員（会場登録・メール無し・年会費免除）');
            $table->index(['is_onsite', 'phone'], 'idx_users_onsite_phone');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('idx_users_onsite_phone');
            $table->dropColumn('is_onsite');
        });
    }
};
