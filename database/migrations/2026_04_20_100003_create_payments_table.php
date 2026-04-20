<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subscription_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->nullable()->constrained()->nullOnDelete();

            $table->string('square_payment_id', 100)->nullable()->unique();
            $table->string('square_order_id', 100)->nullable();
            $table->string('idempotency_key', 100)->unique()->comment('Square 冪等キー');

            $table->unsignedInteger('amount')->comment('円');
            $table->string('currency', 3)->default('JPY');

            $table->enum('status', ['pending', 'completed', 'failed', 'refunded'])
                  ->default('pending');
            $table->string('failure_reason', 500)->nullable();
            $table->string('receipt_url', 500)->nullable();

            $table->timestamp('paid_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->unsignedInteger('refunded_amount')->nullable();

            $table->json('raw_response')->nullable()->comment('Square APIレスポンス保管');

            $table->timestamps();

            $table->index(['user_id', 'status'], 'idx_payments_user_status');
            $table->index('paid_at', 'idx_payments_paid_at');
            $table->index('square_payment_id', 'idx_payments_square_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
