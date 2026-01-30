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
        Schema::table('lane_items', function (Blueprint $table) {
            // sequenceカラムを追加（sequence_orderの別名として）
            if (!Schema::hasColumn('lane_items', 'sequence')) {
                $table->integer('sequence')->unsigned()->default(0)->after('item_id')->comment('レーン内順序');
            }
            
            // statusカラムを追加
            if (!Schema::hasColumn('lane_items', 'status')) {
                $table->string('status', 20)->default('pending')->after('sequence')->comment('ステータス');
            }
        });
        
        // sequence_orderの値をsequenceにコピー
        \DB::statement('UPDATE lane_items SET sequence = sequence_order WHERE sequence = 0');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lane_items', function (Blueprint $table) {
            if (Schema::hasColumn('lane_items', 'sequence')) {
                $table->dropColumn('sequence');
            }
            if (Schema::hasColumn('lane_items', 'status')) {
                $table->dropColumn('status');
            }
        });
    }
};
