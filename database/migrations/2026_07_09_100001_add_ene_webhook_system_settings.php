<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * E-NE 外部連携 Webhook の管理画面設定（key-value）。
 * 既存の管理画面「設定」に "external_integration" カテゴリとして表示される。
 * ※共有シークレット（whsec_...）はここには置かず .env（ENE_WEBHOOK_SECRET）に格納する。
 */
return new class extends Migration
{
    /**
     * @var array<int, array<string, mixed>>
     */
    private array $settings = [
        [
            'setting_key'   => 'ene_webhook_enabled',
            'setting_value' => '0',
            'value_type'    => 'boolean',
            'display_name'  => 'E-NE連携 有効化',
            'description'   => 'ONにすると契約締結Webhookから会員を自動作成します。疎通確認が済むまではOFF推奨。',
        ],
        [
            'setting_key'   => 'ene_email_field_name',
            'setting_value' => 'email',
            'value_type'    => 'string',
            'display_name'  => 'E-NE メールアドレス フィールド名',
            'description'   => 'E-NEのCRMでメールアドレスを持つフィールドのシステム名（crm_fields[].name）。',
        ],
        [
            'setting_key'   => 'ene_default_member_type',
            'setting_value' => 'buyer',
            'value_type'    => 'string',
            'display_name'  => 'E-NE 既定の会員種別',
            'description'   => 'buyer=買受者(participant) / seller=買受者&出品者(participant+seller)。ペイロードに種別があればそちらを優先。',
        ],
        [
            'setting_key'   => 'ene_duplicate_behavior',
            'setting_value' => 'skip',
            'value_type'    => 'string',
            'display_name'  => 'E-NE メール重複時の挙動',
            'description'   => 'skip=何もしない / promote=既存を承認済みに昇格 / error=失敗として記録。',
        ],
    ];

    public function up(): void
    {
        foreach ($this->settings as $s) {
            DB::table('system_settings')->updateOrInsert(
                ['setting_key' => $s['setting_key']],
                [
                    'setting_value' => $s['setting_value'],
                    'value_type'    => $s['value_type'],
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
