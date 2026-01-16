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
        Schema::create('auction_deposits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('auction_id')
                ->unique()
                ->constrained('auctions')
                ->onDelete('cascade')
                ->comment('オークションID');
            $table->decimal('deposit_amount', 10, 2)->default(0.00)->comment('保証金額');
            $table->enum('deposit_type', ['none', 'fixed', 'flexible'])
                ->default('none')
                ->comment('保証金タイプ');
            $table->text('description')->nullable()->comment('説明');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('auction_deposits');
    }
};
