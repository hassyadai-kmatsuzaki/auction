<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::table('system_settings')->updateOrInsert(
            ['setting_key' => 'default_countdown_tiers'],
            [
                'setting_key'   => 'default_countdown_tiers',
                'setting_value' => json_encode([
                    ['from_price' => 0,     'to_price' => 999,   'bid_countdown_seconds' => 5, 'freeze_countdown_seconds' => 1],
                    ['from_price' => 1000,  'to_price' => 4999,  'bid_countdown_seconds' => 5, 'freeze_countdown_seconds' => 1],
                    ['from_price' => 5000,  'to_price' => 9999,  'bid_countdown_seconds' => 5, 'freeze_countdown_seconds' => 1],
                    ['from_price' => 10000, 'to_price' => 49999, 'bid_countdown_seconds' => 5, 'freeze_countdown_seconds' => 1],
                    ['from_price' => 50000, 'to_price' => null,  'bid_countdown_seconds' => 5, 'freeze_countdown_seconds' => 1],
                ]),
                'value_type'    => 'json',
                'category'      => 'auction',
                'display_name'  => '金額帯別カウントダウン秒数テーブル（デフォルト）',
                'description'   => '金額帯ごとの入札カウントダウン・フリーズ秒数。オークションごとにカスタム設定可能。',
                'is_public'     => false,
                'created_at'    => $now,
                'updated_at'    => $now,
            ]
        );
    }

    public function down(): void
    {
        DB::table('system_settings')->where('setting_key', 'default_countdown_tiers')->delete();
    }
};
