<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * R1 (2026-09-14): 認証 API のレート制限を「アカウント単位 + 送信元 IP の天井」の二段構えにする（RateLimitByIp）。
 *
 * - auth_rate_limit_per_ip_per_minute … 送信元 IP ごとの 1 分あたり天井。既定 600。
 *   会場や社内など同じ回線から来る人数を許す値で、アカウント単位の上限（auth_rate_limit_per_minute）を下回らない。
 * - auth_rate_limit_per_minute … 意味が「IP ごと」から「アカウントごと」に変わったので表示名と説明だけ更新する。
 *   値は運用で変更済みの可能性があるので触らない。
 */
return new class extends Migration
{
    private const NEW_ROW = [
        'setting_key'   => 'auth_rate_limit_per_ip_per_minute',
        'setting_value' => '600',
        'value_type'    => 'integer',
        'category'      => 'live_operation',
        'display_name'  => '認証APIの回線別上限（回/分）',
        'description'   => 'ログイン等の認証APIを同じ送信元IPから1分間に受け付ける回数の天井。会場や社内など同じ回線から来る人数を許す値で、アカウント別上限より小さくは効かない。既定 600。',
        'is_public'     => false,
    ];

    private const RENAMED = [
        'display_name' => '認証APIのアカウント別上限（回/分）',
        'description'  => 'ログイン等の認証APIを同じアカウント（メールアドレス等）に対して1分間に受け付ける回数。総当たり対策。既定 10。同じ回線の人数はこの値に関係なく通る（回線別上限を参照）。',
    ];

    public function up(): void
    {
        $exists = DB::table('system_settings')->where('setting_key', self::NEW_ROW['setting_key'])->exists();
        if (!$exists) {
            DB::table('system_settings')->insert(self::NEW_ROW + ['created_at' => now(), 'updated_at' => now()]);
        }

        DB::table('system_settings')
            ->where('setting_key', 'auth_rate_limit_per_minute')
            ->update(self::RENAMED + ['updated_at' => now()]);
    }

    public function down(): void
    {
        DB::table('system_settings')->where('setting_key', self::NEW_ROW['setting_key'])->delete();

        DB::table('system_settings')
            ->where('setting_key', 'auth_rate_limit_per_minute')
            ->update([
                'display_name' => '認証APIのIP別上限（回/分）',
                'description'  => 'ログイン等の認証APIを同一IPから1分間に受け付ける回数。共有回線で弾かれるのを防ぐため、開催当日のみ 60 程度に上げ、終了後に 10 へ戻す。',
                'updated_at'   => now(),
            ]);
    }
};
