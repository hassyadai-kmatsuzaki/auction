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
                'setting_key' => 'venue_open_minutes_before_start',
                'setting_value' => '30',
                'value_type' => 'integer',
                'category' => 'auction',
                'display_name' => '会場入室可能開始（分前）',
                'description' => 'オークション開始の何分前から参加者が会場に入室できるか',
                'is_public' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'setting_key' => 'item_switch_delay_seconds',
                'setting_value' => '5',
                'value_type' => 'integer',
                'category' => 'auction',
                'display_name' => '生体切り替え後の入札開始待機（秒）',
                'description' => 'レーンで次の生体に切り替わった後、入札を開始するまでの待機秒数。0で待機なし',
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
            'venue_open_minutes_before_start',
            'item_switch_delay_seconds',
        ])->delete();
    }
};
