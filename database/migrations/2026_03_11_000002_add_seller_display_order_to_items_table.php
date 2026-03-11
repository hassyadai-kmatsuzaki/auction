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
        Schema::table('items', function (Blueprint $table) {
            $table->integer('seller_display_order')
                ->unsigned()
                ->nullable()
                ->after('item_number')
                ->comment('出品者内での表示順序');
            
            // 出品者内での順序検索用インデックス
            $table->index(['seller_profile_id', 'seller_display_order']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropIndex(['seller_profile_id', 'seller_display_order']);
            $table->dropColumn('seller_display_order');
        });
    }
};
