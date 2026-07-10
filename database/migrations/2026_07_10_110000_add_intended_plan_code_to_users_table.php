<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 加入予定プランのマーカー（1Day会員 E-NE Webhook 対応）。
 *
 * E-NE 契約締結 Webhook でアカウントロール「1Day」の会員を作成したとき、
 * intended_plan_code='one_day' を付与する。マーカーが立っている間、決済モーダルは
 * このプランのみを提示し（他プランの直接POSTは422）、初回決済の完了で自動解除される。
 * 管理者の会員種別切替では切替先の年会費プラン code に書き換わる。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('intended_plan_code', 50)->nullable()
                ->comment('加入予定プランcode。決済モーダルはこのプランのみ提示、決済完了で解除');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('intended_plan_code');
        });
    }
};
