<?php

namespace App\Http\Controllers\Webhook;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessGmoDepositNotificationJob;
use App\Models\SystemSetting;
use App\Services\GmoAozora\GmoDepositIngestService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * GMOあおぞらネット銀行 振込入金口座_入金明細通知（Webhook）受信。
 *
 * 仕様: オープンAPI仕様書 イベント通知編 v1.8.0
 *  - GMO → 当方 POST（Content-Type: application/json;charset=UTF-8）
 *  - Authorization: Basic（当方が申告した user:pass）
 *  - x-webhook-signature: client_secret をキーに HMAC-SHA256(body) → Base64
 *  - x-eventType: va-deposit-transaction
 *  - 成功は HTTP 200 のみ。それ以外は最大1時間リトライ → 配信停止。
 *
 * 設計原則（ライブオークション非影響）:
 *  - Basic + 署名の二重検証 → 冪等（messageId）→ 即 200 を返し、消込は notify キューの Job に委譲する。
 */
class GmoAozoraWebhookController extends Controller
{
    public function __construct(private readonly GmoDepositIngestService $ingest)
    {
    }

    public function handle(Request $request)
    {
        $body = $request->getContent();
        $basicUser = (string) config('services.gmo_aozora.webhook_basic_user', '');
        $basicPass = (string) config('services.gmo_aozora.webhook_basic_pass', '');
        $secret    = (string) config('services.gmo_aozora.client_secret', '');
        $verifySig = filter_var(config('services.gmo_aozora.webhook_verify_signature', true), FILTER_VALIDATE_BOOLEAN);

        // [接続試験用デバッグ] 認証より前に生データを残す（gmo_aozora_webhook_debug=true のときだけ）
        if (SystemSetting::get('gmo_aozora_webhook_debug', false)) {
            Log::info('GMO Aozora webhook raw receive [debug]', [
                'ip'      => $request->ip(),
                'headers' => [
                    'Authorization'       => $request->header('Authorization') ? '(present)' : null,
                    'x-webhook-signature' => $request->header('x-webhook-signature'),
                    'x-eventType'         => $request->header('x-eventType'),
                    'x-access-token'      => $request->header('x-access-token') ? '(present)' : null,
                    'User-Agent'          => $request->header('User-Agent'),
                    'Content-Type'        => $request->header('Content-Type'),
                ],
                'body'         => $body,
                'sig_expected' => $secret !== '' ? base64_encode(hash_hmac('sha256', $body, $secret, true)) : null,
            ]);
        }

        // 0. 未設定は誤配線 → 5xx で気付けるようにする
        if ($basicUser === '' || $basicPass === '') {
            Log::error('GMO Aozora webhook basic auth is not configured');
            return response()->json(['message' => 'server not configured'], 500);
        }

        // 1. Basic 認証（タイミングセーフ比較）
        $reqUser = (string) $request->getUser();
        $reqPass = (string) $request->getPassword();
        if (!hash_equals($basicUser, $reqUser) || !hash_equals($basicPass, $reqPass)) {
            Log::warning('GMO Aozora webhook basic auth mismatch', ['ip' => $request->ip(), 'user' => $reqUser]);
            return response()->json(['message' => 'unauthorized'], 401)
                ->header('WWW-Authenticate', 'Basic realm="gmo-aozora-webhook"');
        }

        // 2. 署名検証（HMAC-SHA256(body, client_secret) → Base64）
        $signature = (string) $request->header('x-webhook-signature', '');
        if ($verifySig) {
            if ($secret === '') {
                Log::error('GMO Aozora webhook signature verification enabled but client_secret is empty');
                return response()->json(['message' => 'server not configured'], 500);
            }
            $expected = base64_encode(hash_hmac('sha256', $body, $secret, true));
            if ($signature === '' || !hash_equals($expected, $signature)) {
                Log::warning('GMO Aozora webhook signature mismatch', ['ip' => $request->ip()]);
                return response()->json(['message' => 'invalid signature'], 401);
            }
        }

        // 3. イベント種別（対象外は受理だけして 200）
        $eventType = (string) $request->header('x-eventType', 'va-deposit-transaction');
        if ($eventType !== 'va-deposit-transaction') {
            Log::info('GMO Aozora webhook ignored event type', ['event_type' => $eventType]);
            return response()->json(['message' => 'ignored']);
        }

        $payload = json_decode($body, true);
        if (!is_array($payload) || empty($payload['messageId'])) {
            return response()->json(['message' => 'missing messageId'], 400);
        }
        $payload['eventType'] = $eventType;

        // 4. 有効化トグル（OFF のときは受理だけして本処理しない = 疎通確認用）
        if (!SystemSetting::get('gmo_aozora_webhook_enabled', false)) {
            Log::info('GMO Aozora webhook received but integration disabled', ['message_id' => $payload['messageId']]);
            return response()->json(['message' => 'integration disabled']); // 200
        }

        // 5. 冪等: 同一 messageId が既に届いていれば 200（再送抑止）
        $notification = $this->ingest->ingestWebhook($payload, $body);
        if (!$notification) {
            return response()->json(['message' => 'already processed']); // 200
        }

        // 6. 本処理は非同期化して即 200。dispatch 失敗時は行を消して 5xx（GMO の再送でやり直させる）
        try {
            ProcessGmoDepositNotificationJob::dispatch($notification->id);
        } catch (\Throwable $e) {
            $notification->delete();
            Log::error('GMO Aozora webhook dispatch failed', [
                'message_id' => $payload['messageId'],
                'error'      => $e->getMessage(),
            ]);
            return response()->json(['message' => 'dispatch failed'], 500);
        }

        return response()->json(['message' => 'accepted']); // 仕様: 成功は 200 のみ
    }
}
