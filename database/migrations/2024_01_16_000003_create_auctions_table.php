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
        Schema::create('auctions', function (Blueprint $table) {
            $table->id();
            $table->string('title')->comment('オークション名');
            $table->date('event_date')->comment('開催日');
            $table->time('start_time')->default('10:00:00')->comment('開始時刻');
            $table->time('end_time')->nullable()->comment('終了時刻(実績)');
            $table->enum('status', ['preparing', 'scheduled', 'live', 'finished', 'cancelled'])
                ->default('preparing')
                ->comment('ステータス');
            $table->text('description')->nullable()->comment('説明');
            
            // オークション設定
            $table->tinyInteger('lane_count')->unsigned()->default(6)->comment('レーン数');
            $table->decimal('default_bid_increment', 10, 2)->default(100.00)->comment('デフォルト入札単位');
            $table->integer('countdown_seconds')->unsigned()->default(3)->comment('カウントダウン秒数');
            $table->boolean('deposit_required')->default(false)->comment('保証金必須フラグ');
            
            // 期限設定
            $table->timestamp('upload_deadline')->nullable()->comment('商品アップロード期限');
            $table->integer('payment_deadline_hours')->unsigned()->default(24)->comment('入金期限(時間)');
            $table->integer('shipping_deadline_hours')->unsigned()->default(48)->comment('発送期限(時間)');
            
            $table->foreignId('created_by')->constrained('users')->comment('作成者ID');
            $table->timestamps();
            
            // インデックス
            $table->index('event_date');
            $table->index('status');
            $table->index(['event_date', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('auctions');
    }
};
