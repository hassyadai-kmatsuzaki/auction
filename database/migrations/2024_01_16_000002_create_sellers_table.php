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
        Schema::create('sellers', function (Blueprint $table) {
            $table->id();
            $table->string('seller_code', 50)->unique()->comment('出品者コード');
            $table->string('seller_name')->comment('出品者名');
            $table->string('contact_name')->nullable()->comment('担当者名');
            $table->string('email')->comment('メールアドレス');
            $table->string('phone', 20)->comment('電話番号');
            $table->string('postal_code', 10)->nullable();
            $table->string('prefecture', 50)->nullable();
            $table->string('city', 100)->nullable();
            $table->string('address_line1')->nullable();
            $table->string('address_line2')->nullable();
            
            // 銀行口座情報
            $table->string('bank_name', 100)->nullable()->comment('銀行名');
            $table->string('bank_branch', 100)->nullable()->comment('支店名');
            $table->enum('account_type', ['checking', 'savings'])->nullable()->comment('口座種別');
            $table->string('account_number', 20)->nullable()->comment('口座番号');
            $table->string('account_holder', 100)->nullable()->comment('口座名義');
            
            $table->decimal('commission_rate', 5, 2)->default(10.00)->comment('手数料率(%)');
            $table->text('notes')->nullable()->comment('備考');
            $table->boolean('is_active')->default(true)->comment('有効フラグ');
            
            $table->timestamps();
            
            // インデックス
            $table->index('email');
            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sellers');
    }
};
