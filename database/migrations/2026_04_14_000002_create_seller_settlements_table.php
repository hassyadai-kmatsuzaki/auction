<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 出品者精算管理テーブル
     *
     * 1オークション × 1出品者 で1行。
     * 管理者が手動で status を更新することで精算状態を制御する。
     */
    public function up(): void
    {
        Schema::create('seller_settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('auction_id')->constrained()->cascadeOnDelete();
            $table->foreignId('seller_profile_id')->constrained()->cascadeOnDelete();

            // 精算状態
            $table->enum('status', ['pending', 'processing', 'completed', 'on_hold', 'cancelled'])
                ->default('pending')
                ->comment('精算ステータス');

            // 金額サマリ（一覧での再集計を避けるため冗長に保持）
            $table->decimal('total_sales', 12, 2)->default(0)->comment('売上合計');
            $table->decimal('total_commission', 12, 2)->default(0)->comment('手数料合計');
            $table->decimal('total_shipping_fee', 12, 2)->default(0)->comment('送料合計');
            $table->decimal('net_amount', 12, 2)->default(0)->comment('出品者受取額');
            $table->unsignedInteger('items_count')->default(0);

            // 実施情報（手動更新）
            $table->timestamp('scheduled_payment_date')->nullable()->comment('精算予定日');
            $table->timestamp('paid_at')->nullable()->comment('精算実施日時');
            $table->foreignId('paid_by')->nullable()->constrained('users')->nullOnDelete()->comment('精算処理者（管理者）');
            $table->string('payment_method', 50)->nullable()->comment('振込/現金/その他');
            $table->string('transaction_reference', 120)->nullable()->comment('振込番号・取引参照番号');
            $table->text('note')->nullable()->comment('備考');

            $table->timestamps();

            $table->unique(['auction_id', 'seller_profile_id'], 'uk_settlement_auction_seller');
            $table->index(['seller_profile_id', 'status'], 'idx_settlement_seller_status');
            $table->index('status');
            $table->index('scheduled_payment_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_settlements');
    }
};
