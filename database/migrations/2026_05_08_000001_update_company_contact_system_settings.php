<?php

use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('system_settings')
            ->where('setting_key', 'company_phone')
            ->update(['setting_value' => '080-4649-9385', 'updated_at' => now()]);

        DB::table('system_settings')
            ->where('setting_key', 'company_email')
            ->update(['setting_value' => 'info@nep-corp.com', 'updated_at' => now()]);

        DB::table('system_settings')
            ->where('setting_key', 'contact_email')
            ->update(['setting_value' => 'info@nep-corp.com', 'updated_at' => now()]);

        SystemSetting::clearCache();
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->where('setting_key', 'company_phone')
            ->update(['setting_value' => '03-1234-5678', 'updated_at' => now()]);

        DB::table('system_settings')
            ->where('setting_key', 'company_email')
            ->update(['setting_value' => 'info@example.com', 'updated_at' => now()]);

        DB::table('system_settings')
            ->where('setting_key', 'contact_email')
            ->update(['setting_value' => 'info@example.com', 'updated_at' => now()]);

        SystemSetting::clearCache();
    }
};
