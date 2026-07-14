<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * E-NE Webhook: 名前フィールドの設定を追加。
 *
 * E-NE(Cal-Connect) の payload `customer.name` はテナントの「顧客名フィールド」
 * (crm_fields.use_for=customer_name) と同期しており、E-NE では会社名/屋号が
 * 顧客名に指定されているため users.name に会社名が入ってしまう。
 * → CRM フィールド「名前」を優先して氏名を取得し、customer.name はフォールバックに降格。
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('system_settings')->updateOrInsert(
            ['setting_key' => 'ene_name_field_name'],
            [
                'setting_value' => '名前',
                'value_type'    => 'string',
                'category'      => 'external_integration',
                'display_name'  => 'E-NE 名前 フィールド名',
                'description'   => 'E-NEのCRMで氏名を持つフィールドの表示名(label) または システム名(name)。見つからない・「未設定」の場合は customer.name（E-NEの顧客名=会社名/屋号のことがある）にフォールバックする。',
                'is_public'     => false,
                'created_at'    => now(),
                'updated_at'    => now(),
            ]
        );
    }

    public function down(): void
    {
        DB::table('system_settings')->where('setting_key', 'ene_name_field_name')->delete();
    }
};
