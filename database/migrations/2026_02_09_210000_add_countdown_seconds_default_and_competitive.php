<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $settings = [
            [
                'setting_key' => 'countdown_seconds_default',
                'setting_value' => '10',
                'value_type' => 'integer',
                'category' => 'auction',
                'display_name' => 'カウントダウン秒数（通常）',
                'description' => '入札者が0〜1人の場合のカウントダウン秒数（開始時・落札決定時）',
                'is_public' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'setting_key' => 'countdown_seconds_competitive',
                'setting_value' => '1',
                'value_type' => 'integer',
                'category' => 'auction',
                'display_name' => 'カウントダウン秒数（競合時）',
                'description' => '入札者が2人以上の場合のカウントダウン秒数（価格上昇後）',
                'is_public' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        foreach ($settings as $setting) {
            if (!DB::table('system_settings')->where('setting_key', $setting['setting_key'])->exists()) {
                DB::table('system_settings')->insert($setting);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('system_settings')->whereIn('setting_key', [
            'countdown_seconds_default',
            'countdown_seconds_competitive',
        ])->delete();
    }
};
