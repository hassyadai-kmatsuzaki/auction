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
        Schema::create('items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('auction_id')
                ->constrained('auctions')
                ->onDelete('cascade')
                ->comment('オークションID');
            $table->foreignId('seller_id')
                ->constrained('sellers')
                ->onDelete('restrict')
                ->comment('出品者ID');
            $table->integer('item_number')->unsigned()->comment('生体番号(オークション内)');
            $table->string('species_name')->comment('品種名');
            $table->integer('quantity')->unsigned()->default(1)->comment('匹数');
            
            // 価格情報
            $table->decimal('start_price', 10, 2)->default(100.00)->comment('開始価格(1匹)');
            $table->decimal('current_price', 10, 2)->default(100.00)->comment('現在価格(1匹)');
            $table->decimal('reserve_price', 10, 2)->nullable()->comment('最低落札価格');
            $table->decimal('estimated_price', 10, 2)->nullable()->comment('落札想定金額');
            $table->decimal('bid_increment', 10, 2)->default(100.00)->comment('入札単位');
            
            // 商品情報
            $table->text('inspection_info')->nullable()->comment('審査情報');
            $table->text('individual_info')->nullable()->comment('個体情報');
            $table->text('notes')->nullable()->comment('備考');
            
            // プレミアムプラン
            $table->boolean('is_premium')->default(false)->comment('プレミアムプランフラグ');
            $table->decimal('premium_fee', 10, 2)->nullable()->comment('プレミアムプラン料金');
            
            $table->string('thumbnail_path', 500)->nullable()->comment('サムネイル画像パス');
            
            // ステータス
            $table->enum('status', ['draft', 'registered', 'live', 'sold', 'unsold', 'cancelled'])
                ->default('draft')
                ->comment('ステータス');
            $table->enum('unsold_action', ['return', 'free_pickup', 'relist'])
                ->nullable()
                ->default('return')
                ->comment('未落札時対応');
            $table->decimal('storage_fee', 10, 2)->nullable()->comment('保管料(次回出品時)');
            
            // タイムスタンプ
            $table->timestamp('live_started_at')->nullable()->comment('オークション開始日時');
            $table->timestamp('live_ended_at')->nullable()->comment('オークション終了日時');
            $table->timestamps();
            
            // インデックス・制約
            $table->unique(['auction_id', 'item_number']);
            $table->index('auction_id');
            $table->index('seller_id');
            $table->index('status');
            $table->index('is_premium');
            $table->index(['auction_id', 'status', 'item_number']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};
