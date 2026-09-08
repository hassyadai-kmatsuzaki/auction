<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * B-2 / B-3 (2026-09-08): 開催当日に管理画面から調整する設定値を system_settings に用意する。
 *
 * - auth_rate_limit_per_minute   … 認証系入口の IP ごと 1 分あたり上限（RateLimitByIp）。平時 10、開催当日 60
 * - live_bidder_updated_throttle_ms … 入札成功ごとの BidderUpdated 配信の商品単位間引き窓（ms）。既定 250
 *
 * 既に行があれば触らない（運用で変更済みの値を上書きしない）。
 */
return new class extends Migration
{
    private const ROWS = [
        [
            'setting_key'   => 'auth_rate_limit_per_minute',
            'setting_value' => '10',
            'value_type'    => 'integer',
            'category'      => 'live_operation',
            'display_name'  => '認証APIのIP別上限（回/分）',
            'description'   => 'ログイン等の認証APIを同一IPから1分間に受け付ける回数。共有回線で弾かれるのを防ぐため、開催当日のみ 60 程度に上げ、終了後に 10 へ戻す。',
            'is_public'     => false,
        ],
        [
            'setting_key'   => 'live_bidder_updated_throttle_ms',
            'setting_value' => '250',
            'value_type'    => 'integer',
            'category'      => 'live_operation',
            'display_name'  => '入札者数配信の間引き（ミリ秒）',
            'description'   => '入札成功ごとの全員配信を商品単位でこの窓内は抑止する。間引いた分は毎秒のカウントダウン配信が補う。負荷が高いときは 500〜1000 に上げる。0 で間引きなし。',
            'is_public'     => false,
        ],
    ];

    public function up(): void
    {
        foreach (self::ROWS as $row) {
            $exists = DB::table('system_settings')->where('setting_key', $row['setting_key'])->exists();
            if (!$exists) {
                DB::table('system_settings')->insert($row + ['created_at' => now(), 'updated_at' => now()]);
            }
        }
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->whereIn('setting_key', array_column(self::ROWS, 'setting_key'))
            ->delete();
    }
};
