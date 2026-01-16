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
        Schema::create('lane_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lane_id')
                ->constrained('lanes')
                ->onDelete('cascade')
                ->comment('レーンID');
            $table->foreignId('item_id')
                ->constrained('items')
                ->onDelete('cascade')
                ->comment('生体ID');
            $table->integer('sequence_order')->unsigned()->comment('レーン内順序');
            $table->timestamp('started_at')->nullable()->comment('開始日時');
            $table->timestamp('finished_at')->nullable()->comment('終了日時');
            $table->integer('duration_seconds')->unsigned()->nullable()->comment('所要時間(秒)');
            $table->timestamps();
            
            // インデックス・制約
            $table->unique('item_id');
            $table->index(['lane_id', 'sequence_order']);
            $table->index('lane_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lane_items');
    }
};
