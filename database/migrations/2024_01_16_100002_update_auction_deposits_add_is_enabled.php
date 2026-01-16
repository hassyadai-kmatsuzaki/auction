<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Phase 1では is_enabled = FALSE（未使用）
     * Phase 2で TRUE に変更して機能を有効化
     */
    public function up(): void
    {
        Schema::table('auction_deposits', function (Blueprint $table) {
            $table->boolean('is_enabled')
                ->default(false)
                ->after('description')
                ->comment('機能有効フラグ（Phase 2でTRUE）');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('auction_deposits', function (Blueprint $table) {
            $table->dropColumn('is_enabled');
        });
    }
};
