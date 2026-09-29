<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * GMOあおぞら 振込入金口座（バーチャル口座）の台帳。
 *
 * 落札者ごとに専用の振込先口座を割り当て、入金明細通知の vaId から落札者を特定する。
 * 口座は /va/issue で発行してプールしておき、割り当て時に user_id を埋める（銀行メンテ中は発行不可のため）。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gmo_virtual_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('environment', 20)->default('development')->comment('production / development');
            $table->string('va_id', 10)->comment('振込入金口座ID');
            $table->string('branch_code', 3)->comment('支店コード');
            $table->string('branch_name_kana', 15)->nullable()->comment('支店名カナ');
            $table->string('account_number', 7)->comment('口座番号');
            $table->string('holder_name_kana', 40)->nullable()->comment('口座名義カナ');
            $table->string('va_type_code', 1)->default('2')->comment('1=期限型 2=継続型');
            $table->string('status_code', 1)->default('1')->comment('1=利用可能 2=停止中 3=削除済');
            $table->string('ra_id', 29)->nullable()->comment('入金口座ID（親口座）');
            $table->timestamp('expire_at')->nullable()->comment('期限型の有効期限');
            $table->foreignId('user_id')->nullable()->comment('割り当てた落札者 users.id')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();
            $table->timestamp('last_deposit_at')->nullable();
            $table->json('raw')->nullable()->comment('GMO 応答の生データ');
            $table->timestamps();

            $table->unique(['environment', 'va_id'], 'uq_gmo_va_env_id');
            $table->index(['user_id', 'status_code'], 'idx_gmo_va_user_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gmo_virtual_accounts');
    }
};
