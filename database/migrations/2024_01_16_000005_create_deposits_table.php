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
        Schema::create('deposits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('auction_id')
                ->constrained('auctions')
                ->onDelete('cascade')
                ->comment('オークションID');
            $table->foreignId('user_id')
                ->constrained('users')
                ->onDelete('cascade')
                ->comment('ユーザーID');
            $table->decimal('deposit_amount', 10, 2)->default(0.00)->comment('預かり金額');
            $table->enum('payment_method', ['bank_transfer', 'credit_card', 'cash'])
                ->default('bank_transfer')
                ->comment('支払い方法');
            $table->enum('payment_status', ['pending', 'confirmed', 'refunded', 'forfeited'])
                ->default('pending')
                ->comment('支払いステータス');
            $table->timestamp('paid_at')->nullable()->comment('入金日時');
            $table->timestamp('refunded_at')->nullable()->comment('返金日時');
            $table->decimal('refund_amount', 10, 2)->nullable()->comment('返金額');
            $table->text('notes')->nullable()->comment('備考');
            $table->timestamps();
            
            // インデックス・制約
            $table->unique(['auction_id', 'user_id']);
            $table->index('user_id');
            $table->index('payment_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('deposits');
    }
};
