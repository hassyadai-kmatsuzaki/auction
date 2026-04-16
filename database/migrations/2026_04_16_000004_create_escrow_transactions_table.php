<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('escrow_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('won_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('buyer_id')->constrained('users');
            $table->foreignId('seller_id')->constrained('users');
            $table->unsignedInteger('amount');
            $table->enum('status', [
                'awaiting_payment',   // 買い手の入金待ち
                'payment_held',       // 入金確認、エスクロー保持中
                'released_to_seller', // 出品者に支払い済み
                'refunded',           // 買い手に返金済み
                'disputed',           // 紛争中
            ])->default('awaiting_payment');
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['buyer_id', 'status']);
            $table->index(['seller_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('escrow_transactions');
    }
};
