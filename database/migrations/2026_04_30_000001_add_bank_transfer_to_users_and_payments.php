<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('payment_method_preference', ['card', 'bank_transfer'])
                  ->nullable()
                  ->after('rejected_reason')
                  ->comment('決済手段の選好。bank_transfer ならログイン時に振込情報モーダルを表示');
            $table->timestamp('bank_transfer_confirmed_at')
                  ->nullable()
                  ->after('payment_method_preference')
                  ->comment('管理者が振込確認した日時。null の間は振込情報モーダルを表示');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->enum('method', ['card', 'bank_transfer'])
                  ->default('card')
                  ->after('currency')
                  ->comment('決済手段');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('method');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['payment_method_preference', 'bank_transfer_confirmed_at']);
        });
    }
};
