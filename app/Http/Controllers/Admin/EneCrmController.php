<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\SendEneCrmUpdateJob;
use App\Models\EneCrmRequest;
use App\Models\User;
use App\Services\Ene\EneCrmClient;
use App\Services\Ene\EneCrmPushService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * 管理画面「設定 → 外部連携」の E-NE CRM 更新（送信）まわり。
 *
 *   - 接続テスト（GET /customers/{line_user_id} が通るか）
 *   - 送信ログの一覧
 *   - 失敗した送信の手動再送
 *   - 任意会員への手動送信（イベント設定どおりの内容をその場で1件送る）
 */
class EneCrmController extends Controller
{
    public function __construct(
        private readonly EneCrmClient $client,
        private readonly EneCrmPushService $push,
    ) {
    }

    /**
     * 接続テスト。会員（users.id）を指定し、その会員の line_user_id で GET を叩く。
     * 更新は行わないので、E-NE 側のデータには影響しない。
     */
    public function test(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        if (!$this->client->isConfigured()) {
            return response()->json([
                'success' => false,
                'message' => 'ベースURL / テナントID / APIキー のいずれかが未設定です。',
            ], 422);
        }

        $user = User::findOrFail($validated['user_id']);
        $lineUserId = $this->push->resolveLineUserId($user);

        if (!$lineUserId) {
            return response()->json([
                'success' => false,
                'message' => 'この会員は E-NE の顧客ID（line_user_id）を保持していないため送信できません。',
            ], 422);
        }

        try {
            $response = $this->client->getCustomer($lineUserId);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => '接続に失敗しました: ' . Str::limit($e->getMessage(), 200),
            ], 422);
        }

        if (!$response->successful()) {
            return response()->json([
                'success'     => false,
                'message'     => $this->describeHttpError($response->status()),
                'http_status' => $response->status(),
                'body'        => Str::limit($response->body(), 500),
            ], 422);
        }

        $body = $response->json() ?? [];

        // LINEユーザーIDは他の経路（User / LineAccount / EneCrmRequest）で伏せているので、
        // ここだけ E-NE のレスポンスを素通しして露出させない。
        $customer = $body['customer'] ?? null;
        if (is_array($customer)) {
            unset($customer['line_user_id']);
        }

        return response()->json([
            'success' => true,
            'message' => '接続に成功しました。',
            'data'    => [
                'customer' => $customer,
                // E-NE 側に存在する CRM フィールド名の一覧。管理画面の入力補助に使う。
                'field_names' => array_keys($body['fields'] ?? []),
                'fields'      => $body['fields'] ?? [],
            ],
        ]);
    }

    /**
     * 送信ログ一覧（新しい順）。
     */
    public function logs(Request $request)
    {
        $query = EneCrmRequest::with(['user:id,name,email'])->latest('id');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($event = $request->query('event')) {
            $query->where('event', $event);
        }

        $logs = $query->paginate(min((int) $request->query('per_page', 20), 100));

        $logs->getCollection()->transform(function (EneCrmRequest $log) {
            return [
                'id'                 => $log->id,
                'event'              => $log->event,
                'event_label'        => $log->event_label,
                'user_id'            => $log->user_id,
                'user_name'          => $log->user?->name,
                'user_email'         => $log->user?->email,
                'fields'             => $log->fields,
                'trigger_automation' => $log->trigger_automation,
                'status'             => $log->status,
                'http_status'        => $log->http_status,
                'error'              => $log->error,
                'attempts'           => $log->attempts,
                'sent_at'            => $log->sent_at?->format('Y-m-d H:i:s'),
                'created_at'         => $log->created_at?->format('Y-m-d H:i:s'),
            ];
        });

        return response()->json(['success' => true, 'data' => $logs]);
    }

    /**
     * 失敗した送信の手動再送（同じ行を pending に戻して Job を投げ直す）。
     */
    public function retry(int $id)
    {
        $log = EneCrmRequest::findOrFail($id);

        if ($log->status === EneCrmRequest::STATUS_SUCCESS) {
            return response()->json(['success' => false, 'message' => '既に成功している送信です。'], 422);
        }
        if (!$log->line_user_id) {
            return response()->json([
                'success' => false,
                'message' => 'line_user_id が無いため再送できません。',
            ], 422);
        }

        $log->update([
            'status'      => EneCrmRequest::STATUS_PENDING,
            'error'       => null,
            'http_status' => null,
        ]);

        SendEneCrmUpdateJob::dispatch($log->id);

        return response()->json(['success' => true, 'message' => '再送をキューに登録しました。']);
    }

    /**
     * 任意の会員へ、イベント設定どおりの内容を手動で1件送る（本番前の実地確認用）。
     * 有効化トグル・イベントのON/OFFは通常どおり尊重する。
     */
    public function send(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'event'   => 'required|string|in:' . implode(',', array_keys(EneCrmRequest::EVENT_LABELS)),
        ]);

        $user = User::findOrFail($validated['user_id']);
        $result = $this->push->push($user, $validated['event']);

        if (!$result) {
            return response()->json([
                'success' => false,
                'message' => '送信されませんでした。連携が無効、イベントがOFF、送信項目が未設定、または接続情報が未設定です。',
            ], 422);
        }

        if ($result->status === EneCrmRequest::STATUS_SKIPPED) {
            return response()->json([
                'success' => false,
                'message' => 'この会員は E-NE の顧客ID（line_user_id）を保持していないためスキップしました。',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => '送信をキューに登録しました。結果は送信ログで確認してください。',
            'data'    => ['request_id' => $result->id],
        ]);
    }

    private function describeHttpError(int $status): string
    {
        return match ($status) {
            401 => 'APIキーが無効です（401）。キーとテナントIDの組み合わせを確認してください。',
            403 => 'スコープ不足です（403）。crm:read / crm:write 付きのキーが必要です。',
            404 => 'E-NE 側にこの顧客が存在しません（404）。',
            429 => 'レート制限を超過しました（429）。',
            default => "E-NE からエラーが返りました（HTTP {$status}）。",
        };
    }
}
