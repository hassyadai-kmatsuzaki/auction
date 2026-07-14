<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * E-NE Webhook: 会社名/屋号・インボイス登録番号フィールドの設定を追加。
 * いずれも任意項目（取れなくても会員作成は続行）。E-NE 側で未入力の場合は
 * 文字列「未設定」が送られてくる合意のため、その場合は保存しない。
 */
return new class extends Migration
{
    /**
     * @var array<int, array<string, string>>
     */
    private array $settings = [
        [
            'setting_key'   => 'ene_company_field_name',
            'setting_value' => '会社名 / 屋号',
            'display_name'  => 'E-NE 会社名/屋号 フィールド名',
            'description'   => 'E-NEのCRMで会社名/屋号を持つフィールドの表示名(label) または システム名(name)。任意項目: 値は users.trade_name（出品者表示名の参照元）と users.company_name の両方に保存。「未設定」の場合は保存しない。',
        ],
        [
            'setting_key'   => 'ene_invoice_field_name',
            'setting_value' => 'インボイス登録番号',
            'display_name'  => 'E-NE インボイス登録番号 フィールド名',
            'description'   => 'E-NEのCRMでインボイス登録番号(T+13桁)を持つフィールドの表示名(label) または システム名(name)。任意項目: 出品者の場合のみ seller_profiles.business_registration_number に保存（免税判定に使用）。「未設定」の場合は保存しない。',
        ],
    ];

    public function up(): void
    {
        foreach ($this->settings as $s) {
            DB::table('system_settings')->updateOrInsert(
                ['setting_key' => $s['setting_key']],
                [
                    'setting_value' => $s['setting_value'],
                    'value_type'    => 'string',
                    'category'      => 'external_integration',
                    'display_name'  => $s['display_name'],
                    'description'   => $s['description'],
                    'is_public'     => false,
                    'created_at'    => now(),
                    'updated_at'    => now(),
                ]
            );
        }
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->whereIn('setting_key', array_column($this->settings, 'setting_key'))
            ->delete();
    }
};
