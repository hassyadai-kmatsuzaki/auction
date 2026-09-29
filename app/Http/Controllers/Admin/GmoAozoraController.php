<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\GmoDepositNotification;
use App\Models\GmoVirtualAccount;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\WonItem;
use App\Services\GmoAozora\GmoAozoraApiException;
use App\Services\GmoAozora\GmoAozoraClient;
use App\Services\GmoAozora\GmoAozoraOAuthService;
use App\Services\GmoAozora\GmoConnectionTestService;
use App\Services\GmoAozora\GmoDepositReconciliationService;
use App\Services\GmoAozora\GmoVirtualAccountService;
use Illuminate\Http\Request;

/**
 * GMOあおぞら連携の運用 API（管理者）。
 *
 * - 接続状態 / 認可開始 / 接続試験 / Webhook 配信制御
 * - 入金通知の一覧と手動消込
 * - 振込入金口座の一覧・発行・割当
 */
class GmoAozoraController extends Controller
{
    public function __construct(
        private readonly GmoAozoraOAuthService $oauth,
        private readonly GmoAozoraClient $client,
        private readonly GmoVirtualAccountService $virtualAccounts,
        private readonly GmoDepositReconciliationService $reconciliation,
    ) {
    }

    /** 接続状態 */
    public function status()
    {
        $token = $this->oauth->token();
        return response()->json([
            'success' => true,
            'data' => [
                'environment'   => $this->oauth->environment(),
                'configured'    => $this->oauth->isConfigured(),
                'client_id'     => $this->oauth->clientId() !== '' ? substr($this->oauth->clientId(), 0, 6) . '…' : null,
                'redirect_uri'  => $this->oauth->redirectUri(),
                'scopes'        => $this->oauth->scopes(),
                'webhook_basic_configured' => config('services.gmo_aozora.webhook_basic_user') !== '' && config('services.gmo_aozora.webhook_basic_pass') !== '',
                'webhook_url'   => url('/api/gmo-aozora/webhook'),
                'transfer_enabled' => filter_var(config('services.gmo_aozora.transfer_enabled', false), FILTER_VALIDATE_BOOLEAN),
                'token'         => $token?->toStatusArray(),
                'settings'      => [
                    'webhook_enabled'      => (bool) SystemSetting::get('gmo_aozora_webhook_enabled', false),
                    'auto_confirm_payment' => (bool) SystemSetting::get('gmo_aozora_auto_confirm_payment', false),
                    'webhook_debug'        => (bool) SystemSetting::get('gmo_aozora_webhook_debug', false),
                ],
                'counts' => [
                    'virtual_accounts_total'      => GmoVirtualAccount::environment()->count(),
                    'virtual_accounts_unassigned' => GmoVirtualAccount::environment()->available()->unassigned()->count(),
                    'deposits_unmatched'          => GmoDepositNotification::where('status', GmoDepositNotification::STATUS_UNMATCHED)->count(),
                    'deposits_matched_pending'    => GmoDepositNotification::where('status', GmoDepositNotification::STATUS_MATCHED)->count(),
                ],
            ],
        ]);
    }

    /** 認可 URL を発行（ブラウザで開いて口座保有者がログイン・認可する） */
    public function oauthStart()
    {
        if (!$this->oauth->isConfigured()) {
            return response()->json(['success' => false, 'message' => 'GMOあおぞらの接続情報（client_id / client_secret / redirect_uri）が .env に未設定です。'], 400);
        }
        $auth = $this->oauth->buildAuthorizationUrl();
        return response()->json(['success' => true, 'data' => ['url' => $auth['url']]]);
    }

    /** トークンを手動リフレッシュ */
    public function refreshToken()
    {
        try {
            $token = $this->oauth->refresh();
        } catch (GmoAozoraApiException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage(), 'error' => $e->toArray()], 400);
        }
        return response()->json(['success' => true, 'data' => $token->toStatusArray()]);
    }

    /** 接続試験（4スコープを参照系で1回ずつ） */
    public function connectionTest(Request $request, GmoConnectionTestService $tester)
    {
        $validated = $request->validate([
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to'   => ['nullable', 'date_format:Y-m-d'],
        ]);
        try {
            $result = $tester->run($validated['date_from'] ?? null, $validated['date_to'] ?? null);
        } catch (GmoAozoraApiException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage(), 'error' => $e->toArray()], 400);
        }
        return response()->json(['success' => $result['ok'], 'data' => $result]);
    }

    /** Webhook 配信開始/停止 */
    public function webhookSubscribe(Request $request)
    {
        $validated = $request->validate(['start' => ['required', 'boolean']]);
        try {
            $this->client->webhookSubscribe((bool) $validated['start']);
        } catch (GmoAozoraApiException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage(), 'error' => $e->toArray()], 400);
        }
        return response()->json(['success' => true, 'message' => $validated['start'] ? '配信開始を要求しました。' : '配信停止を要求しました（反映まで最大10分）。']);
    }

    // ------------------------------------------------------------------
    // 入金通知
    // ------------------------------------------------------------------

    public function deposits(Request $request)
    {
        $validated = $request->validate([
            'status'   => ['nullable', 'string', 'max:20'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $query = GmoDepositNotification::with(['matchedUser:id,name,trade_name,email', 'virtualAccount:id,va_id,user_id,account_number,branch_code'])
            ->orderByDesc('id');
        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }
        $page = $query->paginate($validated['per_page'] ?? 50);

        return response()->json(['success' => true, 'data' => $page]);
    }

    /** matched（自動確認 OFF）の通知を管理者が確定する */
    public function confirmDeposit(Request $request, int $id)
    {
        $n = GmoDepositNotification::findOrFail($id);
        if ($n->status !== GmoDepositNotification::STATUS_MATCHED) {
            return response()->json(['success' => false, 'message' => 'この通知は確定待ち（matched）ではありません。'], 400);
        }
        $this->reconciliation->confirmMatched($n, null, $request->user());
        return response()->json(['success' => true, 'message' => '入金を確認しました。', 'data' => $n->fresh()]);
    }

    /** unmatched の通知を代表 WonItem（落札者×オークション）に手動で紐付けて確定する */
    public function matchDeposit(Request $request, int $id)
    {
        $validated = $request->validate(['won_item_id' => ['required', 'integer', 'exists:won_items,id']]);
        $n = GmoDepositNotification::findOrFail($id);
        if (!in_array($n->status, [GmoDepositNotification::STATUS_UNMATCHED, GmoDepositNotification::STATUS_MATCHED, GmoDepositNotification::STATUS_ERROR], true)) {
            return response()->json(['success' => false, 'message' => 'この通知は手動紐付けの対象ではありません。'], 400);
        }
        $won = WonItem::with('item')->findOrFail($validated['won_item_id']);
        try {
            $this->reconciliation->confirmManually($n, $won, $request->user());
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 400);
        }
        return response()->json(['success' => true, 'message' => '入金を確認しました。', 'data' => $n->fresh()]);
    }

    /** 通知を対象外として閉じる（誤入金・返金対応など） */
    public function ignoreDeposit(Request $request, int $id)
    {
        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:255']]);
        $n = GmoDepositNotification::findOrFail($id);
        if ($n->status === GmoDepositNotification::STATUS_CONFIRMED) {
            return response()->json(['success' => false, 'message' => '確認済みの通知は対象外にできません。'], 400);
        }
        $n->forceFill([
            'status'           => GmoDepositNotification::STATUS_IGNORED,
            'processing_error' => $validated['reason'] ?? null,
            'processed_at'     => $n->processed_at ?? now(),
            'confirmed_by'     => $request->user()->id,
        ])->save();
        return response()->json(['success' => true, 'data' => $n]);
    }

    // ------------------------------------------------------------------
    // 振込入金口座
    // ------------------------------------------------------------------

    public function virtualAccounts(Request $request)
    {
        $validated = $request->validate([
            'unassigned' => ['nullable', 'boolean'],
            'user_id'    => ['nullable', 'integer'],
            'per_page'   => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);
        $query = GmoVirtualAccount::environment()->with('user:id,name,trade_name,email')->orderByDesc('id');
        if (!empty($validated['unassigned'])) {
            $query->unassigned();
        }
        if (!empty($validated['user_id'])) {
            $query->where('user_id', $validated['user_id']);
        }
        return response()->json(['success' => true, 'data' => $query->paginate($validated['per_page'] ?? 50)]);
    }

    /** GMO に口座を発行してプールに追加 */
    public function issueVirtualAccounts(Request $request)
    {
        $validated = $request->validate([
            'count'        => ['required', 'integer', 'min:1', 'max:1000'],
            'va_type_code' => ['nullable', 'in:1,2'],
        ]);
        try {
            $created = $this->virtualAccounts->issue((int) $validated['count'], $validated['va_type_code'] ?? '2');
        } catch (GmoAozoraApiException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage(), 'error' => $e->toArray()], 400);
        }
        return response()->json(['success' => true, 'data' => ['issued' => count($created)]]);
    }

    /** GMO の一覧照会で台帳を同期 */
    public function syncVirtualAccounts()
    {
        try {
            $count = $this->virtualAccounts->syncFromBank();
        } catch (GmoAozoraApiException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage(), 'error' => $e->toArray()], 400);
        }
        return response()->json(['success' => true, 'data' => ['synced' => $count]]);
    }

    /** 落札者に口座を割り当てる */
    public function assignVirtualAccount(Request $request)
    {
        $validated = $request->validate([
            'user_id'        => ['required', 'integer', 'exists:users,id'],
            'issue_if_empty' => ['nullable', 'boolean'],
        ]);
        $user = User::findOrFail($validated['user_id']);
        try {
            $va = $this->virtualAccounts->assignToUser($user, (bool) ($validated['issue_if_empty'] ?? true));
        } catch (GmoAozoraApiException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage(), 'error' => $e->toArray()], 400);
        }
        return response()->json(['success' => true, 'data' => $va->load('user:id,name,trade_name,email')]);
    }
}
