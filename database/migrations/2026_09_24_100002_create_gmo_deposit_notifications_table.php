<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * GMOあおぞら 振込入金口座_入金明細通知（Webhook）の受信ログ兼冪等テーブル。
 *
 * GMO は順序保証なし・重複配信ありで、最大1時間リトライする。
 * messageId（19桁・一意）で二重処理を防ぎ、消込結果（status）を残す。
 * Webhook 以外に gmo-aozora:sync-deposits（入金明細照会 API のポーリング）からも同じ表へ入れる。
 * その場合 message_id は "sync:{vaId}:{itemKey}" とし、Webhook 到着分と itemKey で突合できるようにする。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gmo_deposit_notifications', function (Blueprint $table) {
            $table->id();
            $table->string('message_id', 64)->unique()->comment('GMO messageId（冪等キー）または sync:{vaId}:{itemKey}');
            $table->string('source', 10)->default('webhook')->comment('webhook / sync');
            $table->string('event_type', 40)->default('va-deposit-transaction');
            $table->string('va_id', 10)->nullable()->comment('振込入金口座ID');
            $table->string('item_key', 24)->nullable()->comment('明細キー（口座ID毎に一意）');
            $table->unsignedBigInteger('deposit_amount')->default(0)->comment('入金金額（円）');
            $table->string('remitter_name_kana', 48)->nullable()->comment('振込依頼人名カナ');
            $table->date('transaction_date')->nullable()->comment('取引日');
            $table->longText('payload')->comment('受信生ボディ');
            $table->string('status', 20)->default('received')
                ->comment('received / matched / confirmed / unmatched / ignored / error');
            $table->string('unmatched_reason', 40)->nullable()
                ->comment('no_va / va_unassigned / no_open_items / amount_mismatch');
            $table->foreignId('matched_user_id')->nullable()->comment('特定した落札者')
                ->constrained('users')->nullOnDelete();
            $table->json('won_item_ids')->nullable()->comment('消込対象の won_items.id');
            $table->unsignedBigInteger('expected_amount')->nullable()->comment('照合に使った請求額（税込）');
            $table->timestamp('received_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('confirmed_at')->nullable()->comment('入金確認を won_items に反映した日時');
            $table->foreignId('confirmed_by')->nullable()->comment('手動確認した管理者（自動は null）')
                ->constrained('users')->nullOnDelete();
            $table->text('processing_error')->nullable();
            $table->timestamps();

            $table->index(['va_id', 'item_key'], 'idx_gmo_dep_va_item');
            $table->index('status', 'idx_gmo_dep_status');
            $table->index('transaction_date', 'idx_gmo_dep_txdate');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gmo_deposit_notifications');
    }
};
