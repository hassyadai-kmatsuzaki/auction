<?php

namespace App\Jobs;

use App\Actions\Member\CreateApprovedMemberAction;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * E-NE 契約締結 Webhook の本処理（承認済み会員の作成）。
 *
 * ⚠ ライブオークション非影響のため notify キューで実行する（countdown キュー厳禁）。
 *   Controller は既に 202 を返しており、本処理はここで非同期に走る。
 */
class ProcessEneWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    /**
     * @param array<string, mixed> $payload
     */
    public function __construct(
        public string $deliveryId,
        public array $payload,
    ) {
        $this->onQueue('notify');
    }

    public function handle(CreateApprovedMemberAction $createMember): void
    {
        $event = DB::table('ene_webhook_events')->where('delivery_id', $this->deliveryId)->first();

        // 既に処理済み（手動再送・リトライ）なら何もしない（冪等）
        if (!$event || $event->processed_at) {
            return;
        }

        try {
            $result = $this->process($createMember);

            DB::table('ene_webhook_events')->where('delivery_id', $this->deliveryId)->update([
                'customer_ene_id' => $this->payload['customer']['ene_id'] ?? null,
                'created_user_id' => $result['user_id'],
                'result'          => $result['result'],
                'processed_at'    => now(),
                'updated_at'      => now(),
            ]);
        } catch (\Throwable $e) {
            Log::error('ENE webhook processing failed', [
                'delivery_id' => $this->deliveryId,
                'error'       => $e->getMessage(),
            ]);
            DB::table('ene_webhook_events')->where('delivery_id', $this->deliveryId)->update([
                'processing_error' => Str::limit($e->getMessage(), 1000),
                'updated_at'       => now(),
            ]);
            throw $e; // Job のリトライ（$tries）に委ねる
        }
    }

    /**
     * @return array{user_id: ?int, result: string}
     */
    private function process(CreateApprovedMemberAction $createMember): array
    {
        $customer = $this->payload['customer'] ?? [];

        // メールアドレス抽出（crm_fields の label/name で照合。既定は表示名「メールアドレス」）
        $emailFieldName = (string) SystemSetting::get('ene_email_field_name', 'メールアドレス');
        $email = $this->extractEmail($customer, $emailFieldName);
        if (!$email) {
            throw new \RuntimeException("email not found in crm_fields (field name: {$emailFieldName})");
        }

        $name = $customer['name'] ?? $customer['display_name'] ?? Str::before($email, '@');

        // メール重複時の挙動（users.email は unique。無効化ユーザー is_active=false も含めて検出）
        $existing = User::where('email', $email)->first();
        if ($existing) {
            return $this->handleDuplicate($existing);
        }

        $created = $createMember->execute([
            'name'              => $name,
            'email'             => $email,
            'member_type'       => $this->resolveMemberType($customer),
            'is_test'           => false,
            'line_user_id'      => $customer['line_user_id'] ?? null,
            'line_display_name' => $customer['display_name'] ?? $name,
        ]);

        return ['user_id' => $created['user']->id, 'result' => 'created'];
    }

    /**
     * アカウントロール（crm_fields）から会員種別を決める。
     *   「出品」を含む → seller（seller+participant ロール = 出品も可能）
     *   含まない       → buyer（participant = 買受のみ）
     *   ※ 1day 会員は後日対応。現状は上記2択にフォールバックする。
     *
     * @param array<string, mixed> $customer
     */
    private function resolveMemberType(array $customer): string
    {
        $roleFieldName = (string) SystemSetting::get('ene_role_field_name', 'アカウントロール');

        $roleText = '';
        foreach ($customer['crm_fields'] ?? [] as $field) {
            if (($field['name'] ?? null) === $roleFieldName || ($field['label'] ?? null) === $roleFieldName) {
                // display_value（"出品, 買受" 等の表示名）を優先。無ければ value 配列を連結。
                $roleText = (string) ($field['display_value'] ?? '');
                if ($roleText === '' && is_array($field['value'] ?? null)) {
                    $roleText = implode(',', array_map('strval', $field['value']));
                }
                break;
            }
        }

        return mb_strpos($roleText, '出品') !== false ? 'seller' : 'buyer';
    }

    /**
     * @param array<string, mixed> $customer
     */
    private function extractEmail(array $customer, string $fieldName): ?string
    {
        foreach ($customer['crm_fields'] ?? [] as $field) {
            // name（自動生成スラッグ）と label（管理画面で設定した表示名）の両方で照合する。
            // Cal-Connect の crm_fields.name は "field_xxxx" 形式のため、設定値には label
            // （例:「メールアドレス」）を入れる運用を基本とする。
            if (($field['name'] ?? null) === $fieldName || ($field['label'] ?? null) === $fieldName) {
                $value = $field['value'] ?? $field['display_value'] ?? null;
                // multi_select 等で配列が来た場合は先頭を採用
                $value = is_array($value) ? ($value[0] ?? null) : $value;
                return is_string($value) && $value !== '' ? $value : null;
            }
        }
        return null;
    }

    /**
     * @return array{user_id: ?int, result: string}
     */
    private function handleDuplicate(User $existing): array
    {
        $behavior = (string) SystemSetting::get('ene_duplicate_behavior', 'skip');

        if ($behavior === 'error') {
            throw new \RuntimeException("duplicate email (user_id={$existing->id})");
        }

        // promote: 有効(is_active=true)な既存ユーザーが未承認なら承認済みに昇格。
        // 無効化(is_active=false)ユーザーは意図的な停止の可能性があるため webhook では復活させない。
        if ($behavior === 'promote' && $existing->is_active && $existing->status !== 'approved') {
            $existing->update([
                'status'      => 'approved',
                'approved_at' => $existing->approved_at ?: now(),
            ]);
            return ['user_id' => $existing->id, 'result' => 'promoted'];
        }

        Log::info('ENE webhook: duplicate email skipped', [
            'delivery_id' => $this->deliveryId,
            'user_id'     => $existing->id,
            'behavior'    => $behavior,
        ]);
        return ['user_id' => $existing->id, 'result' => 'skipped'];
    }
}
