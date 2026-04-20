<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('square_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('event_id', 100)->unique()->comment('Square event_id (冪等処理用)');
            $table->string('event_type', 100)->comment('payment.updated など');
            $table->json('payload')->comment('受信ペイロード全文');
            $table->timestamp('received_at')->useCurrent();
            $table->timestamp('processed_at')->nullable();
            $table->string('processing_error', 1000)->nullable();
            $table->timestamps();

            $table->index('event_type', 'idx_sqwh_event_type');
            $table->index('processed_at', 'idx_sqwh_processed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('square_webhook_events');
    }
};
