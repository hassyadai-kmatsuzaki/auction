<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * 当日会員登録（2026-09-20 第9回向け）のマスタ投入。
 *
 * 1. plans に `onsite_free`（0円・30日・落札のみ・自動更新なし）を追加。
 *    is_active=false にして加入モーダルの選択肢には出さない（CheckSubscription は plan.is_active を見ないので入札は通る）。
 *    duration_days を持つ＝単発プラン扱いなので subscriptions:renew の再課金対象にならず、期限後は課金なしで canceled になる。
 * 2. system_settings に ON/OFF と受付コードを追加（ライブ運用タブ）。既定 OFF。
 */
return new class extends Migration
{
    private const PLAN = [
        'code'          => 'onsite_free',
        'name'          => '当日会員',
        'description'   => '会場での当日登録専用。年会費不要・30日間有効・落札のみ・自動更新なし。',
        'amount'        => 0,
        'duration_days' => 30,
        'allows_bid'    => true,
        'allows_sell'   => false,
        'is_active'     => false,
        'sort_order'    => 9,
    ];

    private const SETTINGS = [
        [
            'setting_key'   => 'onsite_registration_enabled',
            'setting_value' => '0',
            'value_type'    => 'boolean',
            'category'      => 'live_operation',
            'display_name'  => '当日会員登録を受け付ける',
            'description'   => 'ON の間だけ /register/onsite から名前・電話番号・パスワードのみで承認済み会員を作成できる（年会費免除・通知なし）。開催当日だけ ON にし、終了後に必ず OFF へ戻す。',
            'is_public'     => false,
        ],
        [
            'setting_key'   => 'onsite_registration_code',
            'setting_value' => '',
            'value_type'    => 'string',
            'category'      => 'live_operation',
            'display_name'  => '当日会員登録の受付コード',
            'description'   => '登録フォームで入力を求める合言葉。空なら受付コード不要。会場の受付で口頭・掲示で伝える。',
            'is_public'     => false,
        ],
    ];

    public function up(): void
    {
        $now = now();

        $exists = DB::table('plans')->where('code', self::PLAN['code'])->exists();
        if (!$exists) {
            DB::table('plans')->insert(self::PLAN + ['created_at' => $now, 'updated_at' => $now]);
        }

        foreach (self::SETTINGS as $row) {
            $exists = DB::table('system_settings')->where('setting_key', $row['setting_key'])->exists();
            if (!$exists) {
                DB::table('system_settings')->insert($row + ['created_at' => $now, 'updated_at' => $now]);
            }
        }
    }

    public function down(): void
    {
        // 既に当日会員のサブスクが紐付いている可能性があるためプラン行は残す（is_active=false のまま）。
        DB::table('system_settings')
            ->whereIn('setting_key', array_column(self::SETTINGS, 'setting_key'))
            ->delete();
    }
};
