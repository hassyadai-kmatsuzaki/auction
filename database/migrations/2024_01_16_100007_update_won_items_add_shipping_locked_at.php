<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * 配送先ロック日時を追加
     * - payment_status が 'paid' or 'confirmed' になった時点でロック
     * - ロック後は配送先変更不可
     */
    public function up(): void
    {
        Schema::table('won_items', function (Blueprint $table) {
            $table->timestamp('shipping_locked_at')
                ->nullable()
                ->after('delivery_status')
                ->comment('配送先ロック日時（入金確認時）');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('won_items', function (Blueprint $table) {
            $table->dropColumn('shipping_locked_at');
        });
    }
};
