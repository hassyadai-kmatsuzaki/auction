<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('line_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('line_user_id', 64)->unique();
            $table->string('display_name', 255)->nullable();
            $table->string('picture_url', 512)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('linked_at')->useCurrent();
            $table->timestamps();
            $table->index('line_user_id');
        });

        Schema::create('line_notification_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('notification_type', 64);
            $table->boolean('is_enabled')->default(true);
            $table->timestamps();
            $table->unique(['user_id', 'notification_type']);
        });

        Schema::create('line_notification_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('notification_type', 64);
            $table->string('line_user_id', 64);
            $table->json('message_payload')->nullable();
            $table->string('status', 16)->default('sent');
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->useCurrent();
            $table->timestamp('created_at')->nullable();
            $table->index('user_id');
            $table->index('sent_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('line_notification_logs');
        Schema::dropIfExists('line_notification_settings');
        Schema::dropIfExists('line_accounts');
    }
};
