<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        $settings = [
            [
                'setting_key'   => 'freeze_countdown_seconds',
                'setting_value' => '1',
                'value_type'    => 'decimal',
                'category'      => 'auction',
                'display_name'  => 'フリーズ（誤タップ防止）カウント',
                'description'   => '入札直後の誤タップ防止期間（0.5〜10秒）',
                'is_public'     => false,
                'created_at'    => $now,
                'updated_at'    => $now,
            ],
            [
                'setting_key'   => 'bid_countdown_seconds',
                'setting_value' => '5',
                'value_type'    => 'decimal',
                'category'      => 'auction',
                'display_name'  => '落札カウント',
                'description'   => '入札受付カウントダウン（0.5〜10秒）',
                'is_public'     => false,
                'created_at'    => $now,
                'updated_at'    => $now,
            ],
            [
                'setting_key'   => 'post_sale_display_seconds',
                'setting_value' => '2',
                'value_type'    => 'decimal',
                'category'      => 'auction',
                'display_name'  => '落札確定後カウント',
                'description'   => '落札確定後の表示時間（0.5〜10秒）',
                'is_public'     => false,
                'created_at'    => $now,
                'updated_at'    => $now,
            ],
            [
                'setting_key'   => 'auction_start_countdown_seconds',
                'setting_value' => '10',
                'value_type'    => 'integer',
                'category'      => 'auction',
                'display_name'  => 'オークション開始待機時間',
                'description'   => 'オークション開始前のカウントダウン（0〜3600秒）',
                'is_public'     => false,
                'created_at'    => $now,
                'updated_at'    => $now,
            ],
            [
                'setting_key'   => 'default_price_increment_tiers',
                'setting_value' => json_encode([
                    ['from_price' => 0,     'to_price' => 999,   'increment_amount' => 50],
                    ['from_price' => 1000,  'to_price' => 4999,  'increment_amount' => 100],
                    ['from_price' => 5000,  'to_price' => 9999,  'increment_amount' => 500],
                    ['from_price' => 10000, 'to_price' => 49999, 'increment_amount' => 1000],
                    ['from_price' => 50000, 'to_price' => null,  'increment_amount' => 5000],
                ]),
                'value_type'    => 'json',
                'category'      => 'auction',
                'display_name'  => '金額帯別上昇幅テーブル（デフォルト）',
                'description'   => '金額帯ごとの価格上昇金額。オークションごとにカスタム設定可能。',
                'is_public'     => false,
                'created_at'    => $now,
                'updated_at'    => $now,
            ],
        ];

        foreach ($settings as $setting) {
            DB::table('system_settings')->updateOrInsert(
                ['setting_key' => $setting['setting_key']],
                $setting
            );
        }
    }

    public function down(): void
    {
        DB::table('system_settings')->whereIn('setting_key', [
            'freeze_countdown_seconds',
            'bid_countdown_seconds',
            'post_sale_display_seconds',
            'auction_start_countdown_seconds',
            'default_price_increment_tiers',
        ])->delete();
    }
};
