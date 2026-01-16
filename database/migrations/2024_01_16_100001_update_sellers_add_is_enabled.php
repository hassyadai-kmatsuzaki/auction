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
        Schema::table('sellers', function (Blueprint $table) {
            $table->boolean('is_enabled')
                ->default(false)
                ->after('notes')
                ->comment('機能有効フラグ（Phase 2でTRUE）');
            
            $table->index('is_enabled');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sellers', function (Blueprint $table) {
            $table->dropIndex(['is_enabled']);
            $table->dropColumn('is_enabled');
        });
    }
};
