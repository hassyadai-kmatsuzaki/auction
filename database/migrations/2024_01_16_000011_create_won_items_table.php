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
        Schema::create('won_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')
                ->unique()
                ->constrained('items')
                ->onDelete('restrict')
                ->comment('生体ID');
            $table->foreignId('winner_id')
                ->constrained('users')
                ->onDelete('restrict')
                ->comment('落札者ID');
            
            // 価格情報
            $table->decimal('winning_price', 10, 2)->comment('落札価格(1匹)');
            $table->integer('quantity')->unsigned()->comment('匹数');
            $table->decimal('total_amount', 10, 2)->comment('合計金額');
            $table->decimal('commission_rate', 5, 2)->default(10.00)->comment('手数料率(%)');
            $table->decimal('commission_amount', 10, 2)->default(0.00)->comment('手数料額');
            $table->decimal('seller_amount', 10, 2)->default(0.00)->comment('出品者受取額');
            
            // 支払い情報
            $table->enum('payment_status', ['pending', 'paid', 'confirmed', 'refunded'])
                ->default('pending')
                ->comment('支払いステータス');
            $table->enum('payment_method', ['bank_transfer', 'credit_card', 'cash', 'onsite'])
                ->nullable()
                ->comment('支払い方法');
            $table->timestamp('paid_at')->nullable()->comment('入金日時');
            $table->timestamp('payment_confirmed_at')->nullable()->comment('入金確認日時');
            $table->timestamp('payment_deadline')->nullable()->comment('入金期限');
            
            // 受取方法
            $table->enum('delivery_method', ['shipping', 'pickup'])
                ->default('shipping')
                ->comment('受取方法');
            $table->timestamp('pickup_datetime')->nullable()->comment('現地引取希望日時');
            $table->enum('pickup_timeslot', [
                'day1_10-12', 'day1_12-14', 'day1_14-16', 'day1_16-18',
                'day2_10-12', 'day2_12-14', 'day2_14-16', 'day2_16-18'
            ])->nullable()->comment('引取時間帯');
            
            // 発送ステータス
            $table->enum('delivery_status', ['pending', 'preparing', 'shipped', 'completed', 'cancelled'])
                ->default('pending')
                ->comment('発送ステータス');
            
            // 配送先情報
            $table->string('shipping_postal_code', 10)->nullable();
            $table->string('shipping_prefecture', 50)->nullable();
            $table->string('shipping_city', 100)->nullable();
            $table->string('shipping_address_line1')->nullable();
            $table->string('shipping_address_line2')->nullable();
            $table->string('shipping_name')->nullable()->comment('受取人氏名');
            $table->string('shipping_phone', 20)->nullable()->comment('受取人電話番号');
            
            // 配送情報
            $table->string('shipping_company', 100)->nullable()->comment('配送業者');
            $table->string('tracking_number', 100)->nullable()->comment('追跡番号');
            $table->timestamp('shipped_at')->nullable()->comment('発送日時');
            $table->timestamp('delivered_at')->nullable()->comment('配達完了日時');
            
            $table->text('notes')->nullable()->comment('備考');
            $table->timestamps();
            
            // インデックス
            $table->index('winner_id');
            $table->index('payment_status');
            $table->index('payment_deadline');
            $table->index('delivery_status');
            $table->index(['winner_id', 'payment_status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('won_items');
    }
};
