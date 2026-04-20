<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('system_settings')->updateOrInsert(
            ['setting_key' => 'tax_rate'],
            [
                'setting_value' => '10',
                'value_type' => 'decimal',
                'category' => 'payment',
                'display_name' => '消費税率（%）',
                'description' => '請求書・納品書・領収書で使用する消費税率',
                'is_public' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    public function down(): void
    {
        DB::table('system_settings')->where('setting_key', 'tax_rate')->delete();
    }
};
