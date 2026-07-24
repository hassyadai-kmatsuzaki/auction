<?php

namespace App\Services\Ene;

use App\Jobs\SendEneCrmUpdateJob;
use App\Models\EneCrmRequest;
use App\Models\LineAccount;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * auction 側のイベント（パスワード設定・決済登録）を E-NE の CRM 更新 API に送る入口。
 *
 * 呼び出し側は push() を1行呼ぶだけ。ここで
 *   1. 有効化トグル / イベント別設定の判定
 *   2. 送信先 line_user_id の解決
 *   3. プレースホルダの展開
 *   4. 送信ログ行（ene_crm_requests）の作成と Job の dispatch
 * まで行う。
 *
 * ⚠ この関数は「絶対に例外を投げない」。パスワード設定も決済も、E-NE 連携の都合で
 *   失敗させてはならない業務のため、内部の失敗はログに落として握る。
 */
class EneCrmPushService
{
    public function __construct(
        private readonly EneCrmClient $client,
    ) {
    }

    /**
     * イベントを E-NE に送る（設定が揃っていなければ何もしない）。
     *
     * @param array<string, mixed> $context プレースホルダの追加値（plan_name / amount 等）
     */
    public function push(User $user, string $event, array $context = []): ?EneCrmRequest
    {
        try {
            return $this->dispatchPush($user, $event, $context);
        } catch (\Throwable $e) {
            Log::error('EneCrmPush: dispatch failed', [
                'event'   => $event,
                'user_id' => $user->id,
                'error'   => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * イベント設定を取得する（管理画面 JSON の1イベント分）。
     *
     * @return array{enabled: bool, trigger_automation: bool, fields: array<int, array{name: string, value: string}>}
     */
    public function eventConfig(string $event): array
    {
        $map = SystemSetting::get('ene_crm_event_map', []);
        $map = is_array($map) ? $map : [];
        $config = $map[$event] ?? [];

        return [
            'enabled'            => (bool) ($config['enabled'] ?? false),
            'trigger_automation' => (bool) ($config['trigger_automation'] ?? false),
            'fields'             => is_array($config['fields'] ?? null) ? $config['fields'] : [],
        ];
    }

    /**
     * 送信先の line_user_id を解決する。
     *
     * 優先順:
     *   1. users.ene_line_user_id（E-NE 由来。本人が LINE 連携を解除しても残る＝最も確実）
     *   2. line_accounts.line_user_id（後から LINE 連携した会員のため）
     *
     * どちらも無い会員（管理画面で手動作成した会員など）は E-NE に顧客が存在しないため送らない。
     */
    public function resolveLineUserId(User $user): ?string
    {
        if (!empty($user->ene_line_user_id)) {
            return (string) $user->ene_line_user_id;
        }

        $lineUserId = LineAccount::where('user_id', $user->id)
            ->where('is_active', true)
            ->value('line_user_id');

        return $lineUserId ? (string) $lineUserId : null;
    }

    /**
     * 設定された fields 定義にプレースホルダを展開して、API に渡す形 { name: value } にする。
     *
     * @param array<int, array{name?: string, value?: string}> $definitions
     * @param array<string, mixed>                             $context
     * @return array<string, mixed>
     */
    public function renderFields(array $definitions, User $user, array $context = []): array
    {
        $placeholders = $this->placeholders($user, $context);

        $rendered = [];
        foreach ($definitions as $definition) {
            $name = trim((string) ($definition['name'] ?? ''));
            if ($name === '') {
                continue;
            }

            $value = (string) ($definition['value'] ?? '');
            foreach ($placeholders as $key => $replacement) {
                $value = str_replace('{{' . $key . '}}', (string) $replacement, $value);
            }

            $rendered[$name] = $this->coerceType($value);
        }

        return $rendered;
    }

    /**
     * 値に埋め込めるプレースホルダの一覧。
     * キーを増やしたら管理画面（EneCrmPushCard の PLACEHOLDERS）も揃えること。
     *
     * @param array<string, mixed> $context
     * @return array<string, string>
     */
    public function placeholders(User $user, array $context = []): array
    {
        $now = Carbon::now();

        return [
            'date'           => $now->format('Y-m-d'),
            'datetime'       => $now->format('Y-m-d H:i'),
            'user_name'      => (string) ($user->name ?? ''),
            'email'          => (string) ($user->email ?? ''),
            'ene_id'         => (string) ($user->ene_customer_id ?? ''),
            'plan_name'      => (string) ($context['plan_name'] ?? ''),
            'plan_code'      => (string) ($context['plan_code'] ?? ''),
            'amount'         => isset($context['amount']) ? (string) (int) $context['amount'] : '',
            'payment_method' => (string) ($context['payment_method'] ?? ''),
        ];
    }

    /**
     * @param array<string, mixed> $context
     */
    private function dispatchPush(User $user, string $event, array $context): ?EneCrmRequest
    {
        if (!SystemSetting::get('ene_crm_push_enabled', false)) {
            return null;
        }

        $config = $this->eventConfig($event);
        if (!$config['enabled']) {
            return null;
        }

        if (!$this->client->isConfigured()) {
            Log::warning('EneCrmPush: skipped, API not configured', ['event' => $event, 'user_id' => $user->id]);
            return null;
        }

        $fields = $this->renderFields($config['fields'], $user, $context);
        if (!$fields) {
            Log::warning('EneCrmPush: skipped, no fields configured', ['event' => $event, 'user_id' => $user->id]);
            return null;
        }

        $lineUserId = $this->resolveLineUserId($user);

        $request = EneCrmRequest::create([
            'event'              => $event,
            'user_id'            => $user->id,
            'line_user_id'       => $lineUserId,
            'fields'             => $fields,
            'trigger_automation' => $config['trigger_automation'],
            // line_user_id が引けない会員は E-NE 側に顧客が存在しない（＝404確定）ので投げずに記録だけ残す
            'status'             => $lineUserId ? EneCrmRequest::STATUS_PENDING : EneCrmRequest::STATUS_SKIPPED,
            'error'              => $lineUserId ? null : 'line_user_id を解決できませんでした（E-NE由来でない会員）',
        ]);

        if ($lineUserId) {
            SendEneCrmUpdateJob::dispatch($request->id);
        }

        return $request;
    }

    /**
     * 入力文字列を E-NE のフィールド型に合う PHP 型へ寄せる（利用ガイド §6）。
     *
     *   ["gold"]  → array   select / multi_select（value の配列で渡す仕様）
     *   true/false→ bool    checkbox
     *   11000     → int     number / currency（文字列で送ると型エラーになりうる）
     *   それ以外   → string  text / date / datetime 等
     *
     * 「0012」のような先頭ゼロ付きは会員番号などの文字列とみなし、数値化しない。
     */
    private function coerceType(string $value): mixed
    {
        $trimmed = trim($value);

        if ($trimmed === '') {
            return $value;
        }

        if ($trimmed[0] === '[' || $trimmed[0] === '{') {
            $decoded = json_decode($trimmed, true);
            return is_array($decoded) ? $decoded : $value;
        }

        if ($trimmed === 'true' || $trimmed === 'false') {
            return $trimmed === 'true';
        }

        if (preg_match('/^-?(0|[1-9]\d*)$/', $trimmed) === 1) {
            return (int) $trimmed;
        }

        return $value;
    }
}
