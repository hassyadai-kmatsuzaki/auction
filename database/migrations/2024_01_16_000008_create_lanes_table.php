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
        Schema::create('lanes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('auction_id')
                ->constrained('auctions')
                ->onDelete('cascade')
                ->comment('オークションID');
            $table->tinyInteger('lane_number')->unsigned()->comment('レーン番号(1-6)');
            $table->string('lane_name', 100)->nullable()->comment('レーン名');
            $table->foreignId('current_item_id')
                ->nullable()
                ->constrained('items')
                ->onDelete('set null')
                ->comment('現在の生体ID');
            $table->enum('status', ['waiting', 'active', 'paused', 'finished'])
                ->default('waiting')
                ->comment('ステータス');
            $table->timestamp('started_at')->nullable()->comment('開始日時');
            $table->timestamp('finished_at')->nullable()->comment('終了日時');
            $table->timestamps();
            
            // インデックス・制約
            $table->unique(['auction_id', 'lane_number']);
            $table->index('auction_id');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lanes');
    }
};
