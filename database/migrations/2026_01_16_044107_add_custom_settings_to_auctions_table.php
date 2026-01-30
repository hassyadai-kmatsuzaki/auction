<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('auctions', function (Blueprint $table) {
            // システムデフォルトを使用するかどうか
            $table->boolean('use_custom_settings')->default(false)->after('shipping_deadline_hours')->comment('カスタム設定を使用するか');
            
            // オークション設定（カスタム値）
            $table->json('custom_auction_settings')->nullable()->after('use_custom_settings')->comment('オークション設定（カスタム）');
            
            // 料金設定（カスタム値）
            $table->json('custom_fee_settings')->nullable()->after('custom_auction_settings')->comment('料金設定（カスタム）');
            
            // 配送・梱包設定（カスタム値）
            $table->json('custom_shipping_settings')->nullable()->after('custom_fee_settings')->comment('配送・梱包設定（カスタム）');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('auctions', function (Blueprint $table) {
            $table->dropColumn([
                'use_custom_settings',
                'custom_auction_settings',
                'custom_fee_settings',
                'custom_shipping_settings',
            ]);
        });
    }
};
