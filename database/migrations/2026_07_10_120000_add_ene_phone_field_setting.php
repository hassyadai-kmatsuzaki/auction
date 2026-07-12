<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * E-NE Webhook: 電話番号フィールドの設定を追加。
 * 電話番号は任意項目（取れなくても会員作成は続行）。決済(Square)にも必須ではないが、
 * 落札後の連絡用に受け取れるようにする。
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('system_settings')->updateOrInsert(
            ['setting_key' => 'ene_phone_field_name'],
            [
                'setting_value' => '電話番号',
                'value_type'    => 'string',
                'category'      => 'external_integration',
                'display_name'  => 'E-NE 電話番号 フィールド名',
                'description'   => 'E-NEのCRMで電話番号を持つフィールドの表示名(label) または システム名(name)。任意項目: 見つからない場合は電話番号なしで会員を作成する。',
                'is_public'     => false,
                'created_at'    => now(),
                'updated_at'    => now(),
            ]
        );
    }

    public function down(): void
    {
        DB::table('system_settings')->where('setting_key', 'ene_phone_field_name')->delete();
    }
};
