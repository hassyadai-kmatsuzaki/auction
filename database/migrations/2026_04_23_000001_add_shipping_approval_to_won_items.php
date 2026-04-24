<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('won_items', function (Blueprint $table) {
            $table->integer('shipping_fee_auto')->nullable()->after('shipping_fee')
                ->comment('自動計算された送料（参考・監査用）');
            $table->timestamp('shipping_approved_at')->nullable()->after('shipping_calculated_at')
                ->comment('管理者による送料承認日時');
            $table->unsignedBigInteger('shipping_approved_by')->nullable()->after('shipping_approved_at')
                ->comment('送料を承認した管理者のuser_id');
            $table->string('shipping_adjustment_reason', 500)->nullable()->after('shipping_approved_by')
                ->comment('送料を手動調整した理由');

            $table->foreign('shipping_approved_by')
                ->references('id')->on('users')
                ->nullOnDelete();
        });

        // 既存データの救済: 既に送料計算済みのレコードは承認済み扱いにする
        // （本番運用開始前ならこの行は不要。運用中データ保護のため入れる）
        DB::table('won_items')
            ->whereNotNull('shipping_calculated_at')
            ->whereNull('shipping_approved_at')
            ->update([
                'shipping_approved_at' => DB::raw('shipping_calculated_at'),
                'shipping_fee_auto' => DB::raw('shipping_fee'),
            ]);
    }

    public function down(): void
    {
        Schema::table('won_items', function (Blueprint $table) {
            $table->dropForeign(['shipping_approved_by']);
            $table->dropColumn([
                'shipping_fee_auto',
                'shipping_approved_at',
                'shipping_approved_by',
                'shipping_adjustment_reason',
            ]);
        });
    }
};
