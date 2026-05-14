<?php

use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $rows = [
            [
                'setting_key' => 'lp_default_cta_buyer',
                'setting_value' => '',
                'value_type' => 'string',
                'category' => 'lp_cvr',
                'display_name' => '買受者LP デフォルトCTA URL',
                'description' => 'rid未指定または未登録のrid訪問者に表示する買受者LPのCTA URL。空欄時はLPのフェイルセーフ値を使用。',
                'is_public' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'setting_key' => 'lp_default_cta_seller',
                'setting_value' => '',
                'value_type' => 'string',
                'category' => 'lp_cvr',
                'display_name' => '出品者LP デフォルトCTA URL',
                'description' => 'rid未指定または未登録のrid訪問者に表示する出品者LPのCTA URL。空欄時はLPのフェイルセーフ値を使用。',
                'is_public' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        foreach ($rows as $row) {
            if (!DB::table('system_settings')->where('setting_key', $row['setting_key'])->exists()) {
                DB::table('system_settings')->insert($row);
            }
        }

        SystemSetting::clearCache();
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->whereIn('setting_key', ['lp_default_cta_buyer', 'lp_default_cta_seller'])
            ->delete();

        SystemSetting::clearCache();
    }
};
