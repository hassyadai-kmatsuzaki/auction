<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 支払通知書の一斉通知（管理画面ボタン）送信記録。
 *
 * 二重送信の防止表示と「前回送信日時」の表示に使う。
 * 送信自体は都度可能（再送を禁止しない）ため unique 制約は付けない。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('seller_settlements', function (Blueprint $table) {
            $table->timestamp('payment_notice_sent_at')->nullable()->after('note');
            $table->unsignedBigInteger('payment_notice_sent_by')->nullable()->after('payment_notice_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('seller_settlements', function (Blueprint $table) {
            $table->dropColumn(['payment_notice_sent_at', 'payment_notice_sent_by']);
        });
    }
};
