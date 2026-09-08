<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * B-6 (2026-09-08): 開催中に管理画面から負荷を落とすための縮退スイッチ。
 *
 * - live_notify_favorite_approaching … お気に入り接近通知（LINE/メール）の ON/OFF
 * - live_tick_broadcast_interval     … カウントダウン配信の間隔（秒）。1=毎秒、2 なら 2 秒ごと（残り 3 秒以下は常に毎秒）
 * - live_image_optimization_bypass   … 画像最適化を迂回し、元画像へ 302 する
 *
 * live_bidder_updated_throttle_ms（配信の間引き幅）は B-2 の migration で投入済み。
 * 既に行があれば触らない。
 */
return new class extends Migration
{
    private const ROWS = [
        [
            'setting_key'   => 'live_notify_favorite_approaching',
            'setting_value' => '1',
            'value_type'    => 'boolean',
            'category'      => 'live_operation',
            'display_name'  => 'お気に入り接近通知を送る',
            'description'   => '商品切替のたびに「あと3番目」のお気に入り登録者へ LINE/メールを送る。通知キューが詰まったら OFF にする（進行には影響しない）。',
            'is_public'     => false,
        ],
        [
            'setting_key'   => 'live_tick_broadcast_interval',
            'setting_value' => '1',
            'value_type'    => 'integer',
            'category'      => 'live_operation',
            'display_name'  => 'カウントダウン配信の間隔（秒）',
            'description'   => '平時は 1（毎秒）。WebSocket サーバーの CPU が高いときは 2〜3 にする。残り 3 秒以下は設定に関係なく毎秒配信する。',
            'is_public'     => false,
        ],
        [
            'setting_key'   => 'live_image_optimization_bypass',
            'setting_value' => '0',
            'value_type'    => 'boolean',
            'category'      => 'live_operation',
            'display_name'  => '画像を元画像のまま配信する（最適化を迂回）',
            'description'   => 'ON にすると画像 API は変換せずに元画像へ転送する。サーバー CPU が張り付いたときの逃げ道。転送量が増えるので平時は OFF。',
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
