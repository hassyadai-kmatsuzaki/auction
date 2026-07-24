<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * auction → E-NE（Cal-Connect）CRM 更新 API 送信の管理画面設定。
 * 既存の「設定 → 外部連携」タブ（category=external_integration）に並べて表示する。
 *
 * APIキーは system_settings に保存するが、管理画面へは常にマスクして返す
 * （SystemSettingController::MASKED_KEYS）。
 */
return new class extends Migration
{
    /**
     * イベントごとの送信内容。fields は E-NE 側 CRM フィールドの name（または label）と値の組。
     * 値には {{datetime}} {{plan_name}} 等のプレースホルダが使える（EneCrmPushService::placeholders）。
     *
     * 既定は「全イベントOFF・fields空」。E-NE 側のフィールド名が確定してから画面で設定する。
     */
    private const DEFAULT_EVENT_MAP = [
        'password_set' => [
            'enabled'            => false,
            'trigger_automation' => false,
            'fields'             => [],
        ],
        'subscription_paid' => [
            'enabled'            => false,
            'trigger_automation' => false,
            'fields'             => [],
        ],
        'bank_transfer_requested' => [
            'enabled'            => false,
            'trigger_automation' => false,
            'fields'             => [],
        ],
    ];

    /**
     * @return array<int, array<string, mixed>>
     */
    private function settings(): array
    {
        return [
            [
                'setting_key'   => 'ene_crm_push_enabled',
                'setting_value' => '0',
                'value_type'    => 'boolean',
                'display_name'  => 'E-NE CRM更新の送信 有効化',
                'description'   => 'ONにすると、パスワード設定・決済登録の際にE-NEのCRMを更新します。個別イベントのON/OFFとは AND 条件。',
            ],
            [
                'setting_key'   => 'ene_crm_base_url',
                'setting_value' => '',
                'value_type'    => 'string',
                'display_name'  => 'E-NE CRM APIのベースURL',
                'description'   => 'セントラルドメイン。例: https://anken.cloud （末尾スラッシュ不要）',
            ],
            [
                'setting_key'   => 'ene_crm_tenant_id',
                'setting_value' => '',
                'value_type'    => 'string',
                'display_name'  => 'E-NE テナントID',
                'description'   => 'E-NE 管理者から共有されるテナントID（数字）。',
            ],
            [
                'setting_key'   => 'ene_crm_api_key',
                'setting_value' => '',
                'value_type'    => 'string',
                'display_name'  => 'E-NE APIキー',
                'description'   => 'cc_live_… 形式。crm:write スコープが必要。管理画面には先頭数文字のみ表示する。',
            ],
            [
                'setting_key'   => 'ene_crm_event_map',
                'setting_value' => json_encode(self::DEFAULT_EVENT_MAP, JSON_UNESCAPED_UNICODE),
                'value_type'    => 'json',
                'display_name'  => 'E-NE CRM更新のイベント設定',
                'description'   => 'イベントごとの有効/無効・trigger_automation・送信するCRM項目（name→値）。',
            ],
        ];
    }

    public function up(): void
    {
        foreach ($this->settings() as $s) {
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
            ->whereIn('setting_key', array_column($this->settings(), 'setting_key'))
            ->delete();
    }
};
