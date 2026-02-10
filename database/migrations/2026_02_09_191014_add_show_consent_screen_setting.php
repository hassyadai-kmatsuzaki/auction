<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 同意画面表示設定を追加
        $setting = [
            'setting_key' => 'show_consent_screen',
            'setting_value' => '0',
            'value_type' => 'boolean',
            'category' => 'auction',
            'display_name' => '同意画面表示',
            'description' => 'オークション開始時に同意画面を表示する',
            'is_public' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        // 既存のキーがなければ挿入
        if (!DB::table('system_settings')->where('setting_key', 'show_consent_screen')->exists()) {
            DB::table('system_settings')->insert($setting);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('system_settings')->where('setting_key', 'show_consent_screen')->delete();
    }
};
