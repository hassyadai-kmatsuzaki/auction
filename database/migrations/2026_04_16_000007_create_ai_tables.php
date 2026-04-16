<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // AI画像解析結果
        Schema::create('ai_image_analyses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_media_id')->nullable()->constrained()->nullOnDelete();
            $table->json('body_shape_features')->nullable()->comment('体型特徴');
            $table->json('color_features')->nullable()->comment('色彩特徴');
            $table->json('pattern_features')->nullable()->comment('模様特徴');
            $table->decimal('quality_score', 4, 2)->nullable()->comment('品質スコア 0-10');
            $table->string('predicted_breed', 100)->nullable()->comment('推定品種');
            $table->decimal('breed_confidence', 5, 2)->nullable()->comment('品種推定信頼度%');
            $table->json('raw_response')->nullable()->comment('AIモデルの生レスポンス');
            $table->string('model_version', 50)->nullable();
            $table->timestamps();

            $table->index('item_id');
        });

        // AI価格予測
        Schema::create('ai_price_predictions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('species_name', 100);
            $table->unsignedInteger('predicted_price');
            $table->unsignedInteger('price_low');
            $table->unsignedInteger('price_high');
            $table->decimal('confidence', 5, 2)->comment('信頼度%');
            $table->json('factors')->nullable()->comment('予測に使用した要素');
            $table->unsignedInteger('actual_price')->nullable()->comment('実際の落札価格');
            $table->string('model_version', 50)->nullable();
            $table->timestamps();

            $table->index('species_name');
        });

        // AI不正検知アラート
        Schema::create('ai_fraud_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('auction_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('alert_type', ['bid_pattern', 'price_manipulation', 'shill_bidding', 'account_abuse']);
            $table->enum('severity', ['low', 'medium', 'high', 'critical']);
            $table->text('description');
            $table->json('evidence')->nullable();
            $table->enum('status', ['open', 'investigating', 'resolved', 'false_positive'])->default('open');
            $table->text('resolution_notes')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'severity']);
            $table->index('auction_id');
        });

        // AIレコメンデーション
        Schema::create('ai_recommendations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->cascadeOnDelete();
            $table->decimal('score', 5, 4)->comment('推薦スコア 0-1');
            $table->string('reason', 200)->nullable();
            $table->enum('source', ['collaborative', 'content_based', 'hybrid', 'trending']);
            $table->boolean('was_viewed')->default(false);
            $table->boolean('was_bid')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'score']);
            $table->unique(['user_id', 'item_id']);
        });

        // AI学習用データセット
        Schema::create('ai_training_data', function (Blueprint $table) {
            $table->id();
            $table->string('data_type', 50)->comment('image, price, behavior');
            $table->foreignId('item_id')->nullable()->constrained()->nullOnDelete();
            $table->json('features');
            $table->json('labels')->nullable();
            $table->boolean('is_validated')->default(false);
            $table->timestamps();

            $table->index('data_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_training_data');
        Schema::dropIfExists('ai_recommendations');
        Schema::dropIfExists('ai_fraud_alerts');
        Schema::dropIfExists('ai_price_predictions');
        Schema::dropIfExists('ai_image_analyses');
    }
};
