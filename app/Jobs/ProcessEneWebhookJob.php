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
        $email = $this->extractField($customer, $emailFieldName);
        if (!$email) {
            throw new \RuntimeException("email not found in crm_fields (field name: {$emailFieldName})");
        }

        // 名前は CRM フィールド「名前」を優先する。payload の customer.name は E-NE の
        // 「顧客名フィールド」(use_for=customer_name) と同期しており、E-NE では会社名/屋号が
        // 顧客名に指定されているため、customer.name だと users.name に会社名が入ってしまう。
        $nameFieldName = (string) SystemSetting::get('ene_name_field_name', '名前');
        $name = $this->rejectUnset($this->extractField($customer, $nameFieldName))
            ?? $customer['name']
            ?? $customer['display_name']
            ?? Str::before($email, '@');

        // 電話番号抽出（任意項目: 無ければ null のまま会員を作成する）
        $phoneFieldName = (string) SystemSetting::get('ene_phone_field_name', '電話番号');
        $phone = $this->normalizePhone($this->extractField($customer, $phoneFieldName));

        // 会社名/屋号（任意項目）: E-NE 側は1フィールドのため、users.trade_name
        // （出品者表示名の参照元）と users.company_name の両方に同じ値を保存する。
        // E-NE 側で未入力の場合は文字列「未設定」が来る合意のため、その場合は null。
        $companyFieldName = (string) SystemSetting::get('ene_company_field_name', '会社名 / 屋号');
        $companyOrTradeName = $this->rejectUnset($this->extractField($customer, $companyFieldName));

        // インボイス登録番号（任意項目）: 出品者の場合のみ SellerProfile に保存される。
        // 全角入力でも免税判定（T+13桁, InvoiceTaxResolver）に一致するよう半角化する。
        $invoiceFieldName = (string) SystemSetting::get('ene_invoice_field_name', 'インボイス登録番号');
        $invoiceNumber = $this->rejectUnset($this->extractField($customer, $invoiceFieldName));
        if ($invoiceNumber !== null) {
            $invoiceNumber = strtoupper(trim(mb_convert_kana($invoiceNumber, 'as')));
        }

        // メール重複時の挙動（users.email は unique。無効化ユーザー is_active=false も含めて検出）
        $existing = User::where('email', $email)->first();
        if ($existing) {
            return $this->handleDuplicate($existing);
        }

        $created = $createMember->execute([
            'name'                        => $name,
            'email'                       => $email,
            'phone'                       => $phone,
            'trade_name'                  => $companyOrTradeName,
            'company_name'                => $companyOrTradeName,
            'invoice_registration_number' => $invoiceNumber,
            'member_type'                 => $this->resolveMemberType($customer),
            'is_test'                     => false,
            'line_user_id'                => $customer['line_user_id'] ?? null,
            'line_display_name'           => $customer['display_name'] ?? $name,
            // E-NE 側の識別子。CRM 更新 API（送信）のキーになるので users に保持する。
            'ene_customer_id'             => $customer['ene_id'] ?? null,
        ]);

        return ['user_id' => $created['user']->id, 'result' => 'created'];
    }

    /**
     * アカウントロール（crm_fields）から会員種別を決める。
     *   「1Day」を含む → one_day（participant ロール + intended_plan_code=one_day。
     *                     決済モーダルには1Dayプランのみ提示される）
     *   「出品」を含む → seller（seller+participant ロール = 出品も可能）
     *   いずれも無し   → buyer（participant = 買受のみ）
     *
     * 1Day は落札専用のため出品より優先して判定する（「1Day」と「出品」が同時に来る
     * 契約は業務上存在しない想定。万一来ても安全側=出品不可に倒す）。
     * 表記は半角「1Day」で E-NE と合意（大文字小文字は不問で拾う）。
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

        if (stripos($roleText, '1day') !== false) {
            return 'one_day';
        }

        return mb_strpos($roleText, '出品') !== false ? 'seller' : 'buyer';
    }

    /**
     * crm_fields から指定フィールドの値を取り出す（email / 電話番号 等 共通）。
     *
     * @param array<string, mixed> $customer
     */
    private function extractField(array $customer, string $fieldName): ?string
    {
        $fields = $customer['crm_fields'] ?? [];

        foreach ($fields as $field) {
            // name（自動生成スラッグ）と label（管理画面で設定した表示名）の両方で照合する。
            // Cal-Connect の crm_fields.name は "field_xxxx" 形式のため、設定値には label
            // （例:「メールアドレス」）を入れる運用を基本とする。
            if (($field['name'] ?? null) === $fieldName || ($field['label'] ?? null) === $fieldName) {
                return $this->fieldValue($field);
            }
        }

        // 完全一致で見つからない場合は空白（全角含む）を無視して再照合する。
        // 「会社名 / 屋号」と「会社名/屋号」のようなスペース表記ゆれで
        // 取りこぼすと silent にデータが落ちるため（E-NE側labelの正確な表記は画面から確定できない）。
        $target = preg_replace('/[\s　]+/u', '', $fieldName);
        foreach ($fields as $field) {
            foreach (['name', 'label'] as $key) {
                $candidate = $field[$key] ?? null;
                if (is_string($candidate) && preg_replace('/[\s　]+/u', '', $candidate) === $target) {
                    return $this->fieldValue($field);
                }
            }
        }

        return null;
    }

    /**
     * crm_fields の1要素から文字列値を取り出す。
     *
     * @param array<string, mixed> $field
     */
    private function fieldValue(array $field): ?string
    {
        $value = $field['value'] ?? $field['display_value'] ?? null;
        // multi_select 等で配列が来た場合は先頭を採用
        $value = is_array($value) ? ($value[0] ?? null) : $value;
        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * E-NE の未入力プレースホルダ「未設定」を null に落とす（任意項目共通）。
     */
    private function rejectUnset(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $trimmed = trim($value);
        return ($trimmed === '' || $trimmed === '未設定') ? null : $trimmed;
    }

    /**
     * 電話番号の正規化。全角→半角に直し、電話番号として妥当（数字9〜16桁）でなければ
     * null を返して「電話番号なし」で作成する（会員作成は止めない）。
     *
     * ⚠ 不正な文字列を users.phone に残すと、決済時の Square Customer 作成
     *   （phone_number の形式検証あり）が失敗して初回課金ごと落ちるため、ここで弾く。
     */
    private function normalizePhone(?string $raw): ?string
    {
        if ($raw === null) {
            return null;
        }

        $phone = mb_convert_kana(trim($raw), 'as'); // 全角英数・スペース→半角
        $phone = preg_replace('/[^\d+\-() ]/', '', $phone) ?? '';
        $digits = preg_replace('/\D/', '', $phone) ?? '';

        if (strlen($digits) < 9 || strlen($digits) > 16 || mb_strlen($phone) > 20) {
            Log::warning('ENE webhook: invalid phone format, stored as null', [
                'delivery_id' => $this->deliveryId,
            ]);
            return null;
        }

        return $phone;
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
