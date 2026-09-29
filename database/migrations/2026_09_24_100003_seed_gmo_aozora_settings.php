<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * GMOあおぞら連携の運用トグルを system_settings に投入する（既定はすべて OFF）。
 *
 * クレデンシャルは .env（config/services.php gmo_aozora）に置き、ここには入れない。
 * SystemSetting::set() は未登録キーを保存できないため、キーはマイグレーションで作る。
 */
return new class extends Migration
{
    private const SETTINGS = [
        [
            'setting_key'   => 'gmo_aozora_webhook_enabled',
            'setting_value' => '0',
            'value_type'    => 'boolean',
            'category'      => 'external_integration',
            'display_name'  => 'GMOあおぞら 入金通知を受け付ける',
            'description'   => 'OFF の間は Webhook を認証・記録だけして消込処理を行わない（疎通確認用）。接続試験が終わったら ON。',
            'is_public'     => false,
        ],
        [
            'setting_key'   => 'gmo_aozora_auto_confirm_payment',
            'setting_value' => '0',
            'value_type'    => 'boolean',
            'category'      => 'external_integration',
            'display_name'  => 'GMOあおぞら 入金額が一致したら自動で入金確認にする',
            'description'   => 'ON: 振込入金口座の入金額が落札者の請求額（税込）と一致した場合、管理画面の「入金確認」と同じ処理を自動実行し落札者へ通知する。OFF: 突合結果を記録するだけで、確認は管理者が行う。',
            'is_public'     => false,
        ],
        [
            'setting_key'   => 'gmo_aozora_webhook_debug',
            'setting_value' => '0',
            'value_type'    => 'boolean',
            'category'      => 'external_integration',
            'display_name'  => 'GMOあおぞら Webhook の生データをログに残す',
            'description'   => '接続試験中だけ ON。認証に失敗した場合もヘッダと本文を production.log に記録する（振込人名などの個人情報を含むため通常は OFF）。',
            'is_public'     => false,
        ],
    ];

    public function up(): void
    {
        $now = now();
        foreach (self::SETTINGS as $row) {
            $exists = DB::table('system_settings')->where('setting_key', $row['setting_key'])->exists();
            if (!$exists) {
                DB::table('system_settings')->insert($row + ['created_at' => $now, 'updated_at' => $now]);
            }
        }
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->whereIn('setting_key', array_column(self::SETTINGS, 'setting_key'))
            ->delete();
    }
};
