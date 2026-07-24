<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * users に E-NE（Cal-Connect）側の識別子を持たせる。
 *
 * E-NE の CRM 更新 API はキーが line_user_id のため、送信時に必ず必要になる。
 * line_accounts.line_user_id にも同じ値は入るが、本人が「LINE連携解除」すると消える。
 * 連携解除しても E-NE 側の顧客は存在し続けるので、送信先の解決は users 側に持つ。
 *
 * 既存会員は ene_webhook_events.payload（受信生ボディを全件保持）から backfill する。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('ene_line_user_id', 64)->nullable()->after('google_id')
                ->comment('E-NE CRM更新APIのキー（LINEユーザーID）。連携解除しても保持する');
            $table->unsignedBigInteger('ene_customer_id')->nullable()->after('ene_line_user_id')
                ->comment('E-NE顧客番号（ene_id）。突合・調査用');
            $table->index('ene_line_user_id');
        });

        $this->backfill();
    }

    /**
     * 既に E-NE Webhook 経由で作成済みの会員に identity を埋める。
     * payload は受信生ボディ（JSON文字列）なので decode して customer から取り出す。
     */
    private function backfill(): void
    {
        if (!Schema::hasTable('ene_webhook_events')) {
            return;
        }

        DB::table('ene_webhook_events')
            ->whereNotNull('created_user_id')
            ->orderBy('id')
            ->chunk(200, function ($events) {
                foreach ($events as $event) {
                    $payload  = json_decode((string) $event->payload, true);
                    $customer = is_array($payload) ? ($payload['customer'] ?? []) : [];

                    $lineUserId = $customer['line_user_id'] ?? null;
                    $eneId      = $customer['ene_id'] ?? $event->customer_ene_id ?? null;

                    // 取れた項目だけを埋める。同一ユーザーに複数 delivery がある場合、
                    // 値を持つ delivery だけが上書きするので「後の空で消える」ことはない。
                    $update = [];
                    if (is_string($lineUserId) && $lineUserId !== '') {
                        $update['ene_line_user_id'] = $lineUserId;
                    }
                    if (is_numeric($eneId)) {
                        $update['ene_customer_id'] = (int) $eneId;
                    }
                    if (!$update) {
                        continue;
                    }

                    DB::table('users')->where('id', $event->created_user_id)->update($update);
                }
            });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['ene_line_user_id']);
            $table->dropColumn(['ene_line_user_id', 'ene_customer_id']);
        });
    }
};
