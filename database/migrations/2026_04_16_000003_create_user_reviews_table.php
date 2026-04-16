<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reviewer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('reviewee_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('won_item_id')->constrained('won_items')->cascadeOnDelete();
            $table->enum('role', ['buyer', 'seller'])->comment('reviewer の立場');
            $table->tinyInteger('rating')->comment('1-5');
            $table->text('comment')->nullable();
            $table->timestamps();

            $table->unique(['won_item_id', 'role'], 'unique_review_per_transaction_role');
            $table->index('reviewee_id');
            $table->index('reviewer_id');
        });

        // ユーザーに信頼度スコアキャッシュを追加
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('trust_score', 3, 2)->default(0)->after('is_active');
            $table->unsignedInteger('review_count')->default(0)->after('trust_score');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_reviews');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['trust_score', 'review_count']);
        });
    }
};
