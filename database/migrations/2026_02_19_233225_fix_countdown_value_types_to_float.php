<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * countdown_seconds_competitive, countdown_seconds_default, item_switch_delay_seconds の
 * value_type を integer → float に変更。
 *
 * 0.5秒単位の設定値が (int) キャストで 0 に丸められるバグを修正。
 */
return new class extends Migration
{
    public function up(): void
    {
        $keysToFix = [
            'countdown_seconds_competitive',
            'countdown_seconds_default',
            'item_switch_delay_seconds',
        ];

        // ENUM('string','integer','decimal','boolean','json') なので decimal を使用
        DB::table('system_settings')
            ->whereIn('setting_key', $keysToFix)
            ->update(['value_type' => 'decimal']);
    }

    public function down(): void
    {
        $keysToFix = [
            'countdown_seconds_competitive',
            'countdown_seconds_default',
            'item_switch_delay_seconds',
        ];

        DB::table('system_settings')
            ->whereIn('setting_key', $keysToFix)
            ->update(['value_type' => 'integer']);
    }
};
