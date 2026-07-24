<?php

namespace App\Services\Ene;

use App\Models\SystemSetting;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * E-NE（Cal-Connect）外部連携 CRM API のクライアント。
 *
 * 仕様: docs「Cal-Connect 外部連携 CRM API 利用ガイド（インバウンド）」v1.0
 *   GET   /api/external/{tenant_id}/customers/{line_user_id}
 *   PATCH /api/external/{tenant_id}/customers/{line_user_id}
 *
 * 接続情報は管理画面（system_settings, category=external_integration）で設定する。
 * 未設定の場合のみ .env（ENE_CRM_*）にフォールバックする。
 *
 * ⚠ このクラスは HTTP を同期で叩く。呼び出しは必ず SendEneCrmUpdateJob 経由（notify キュー）にし、
 *   Web リクエスト（パスワード設定・決済）を E-NE の応答時間に巻き込まないこと。
 */
class EneCrmClient
{
    /** E-NE 側のレート制限は 120req/分。詰まらせないよう短めに切る。 */
    private const TIMEOUT_SECONDS = 10;

    public function baseUrl(): string
    {
        $value = (string) SystemSetting::get('ene_crm_base_url', '');
        $value = $value !== '' ? $value : (string) config('services.ene.crm.base_url');

        return rtrim(trim($value), '/');
    }

    public function tenantId(): string
    {
        $value = trim((string) SystemSetting::get('ene_crm_tenant_id', ''));

        return $value !== '' ? $value : trim((string) config('services.ene.crm.tenant_id'));
    }

    public function apiKey(): string
    {
        $value = trim((string) SystemSetting::get('ene_crm_api_key', ''));

        return $value !== '' ? $value : trim((string) config('services.ene.crm.api_key'));
    }

    public function isConfigured(): bool
    {
        return $this->baseUrl() !== '' && $this->tenantId() !== '' && $this->apiKey() !== '';
    }

    /**
     * 顧客の CRM を取得する（接続テスト用）。
     */
    public function getCustomer(string $lineUserId): Response
    {
        return $this->request()->get($this->customerUrl($lineUserId));
    }

    /**
     * 顧客の CRM を一括更新する。
     *
     * @param array<string, mixed> $fields  { "CRMフィールドname": 値 }
     */
    public function updateFields(string $lineUserId, array $fields, bool $triggerAutomation): Response
    {
        return $this->request()->patch($this->customerUrl($lineUserId), [
            'fields'             => $fields,
            'trigger_automation' => $triggerAutomation,
        ]);
    }

    private function customerUrl(string $lineUserId): string
    {
        return sprintf(
            '%s/api/external/%s/customers/%s',
            $this->baseUrl(),
            rawurlencode($this->tenantId()),
            rawurlencode($lineUserId),
        );
    }

    private function request(): \Illuminate\Http\Client\PendingRequest
    {
        return Http::withToken($this->apiKey())
            ->acceptJson()
            ->asJson()
            ->timeout(self::TIMEOUT_SECONDS);
    }
}
