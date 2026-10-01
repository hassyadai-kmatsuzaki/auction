<?php

namespace App\Http\Controllers\Webhook;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessGmoDepositNotificationJob;
use App\Models\SystemSetting;
use App\Services\GmoAozora\GmoAozoraOAuthService;
use App\Services\GmoAozora\GmoAozoraRequestGate;
use App\Services\GmoAozora\GmoDepositIngestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * GMOあおぞらネット銀行 振込入金口座_入金明細通知（Webhook）受信。
 *
 * 仕様: オープンAPI仕様書 イベント通知編 v1.8.0
 *  - GMO → 当方 POST（Content-Type: application/json;charset=UTF-8）
 *  - Authorization: Basic（当方が申告した user:pass）… 申請済みのセキュリティオプション
 *  - x-access-token: 通知対象ユーザー（当社口座）に発行されたアクセストークン … 受信側で一致を検証する
 *  - x-webhook-signature: 署名オプション選択時のみ付く（当社は Basic を選択したので通常は来ない）
 *  - x-eventType: va-deposit-transaction
 *  - 成功は HTTP 200 のみ。それ以外は最大1時間リトライ → 配信停止。
 *
 * 検証順: Basic 認証 → アクセストークン一致 → （有効時のみ）署名。
 * 設計原則（ライブオークション非影響）: 検証 → 冪等（messageId）→ 即 200 を返し、消込は notify キューの Job に委譲する。
 * 受信結果は gmo_aozora_api ログ（inbound）に残す（GMO 提出用の API 実行ログ）。
 */
class GmoAozoraWebhookController extends Controller
{
    public function __construct(
        private readonly GmoDepositIngestService $ingest,
        private readonly GmoAozoraOAuthService $oauth,
        private readonly GmoAozoraRequestGate $gate,
    ) {
    }

    public function handle(Request $request)
    {
        $body = $request->getContent();
        $basicUser = (string) config('services.gmo_aozora.webhook_basic_user', '');
        $basicPass = (string) config('services.gmo_aozora.webhook_basic_pass', '');
        $secret    = (string) config('services.gmo_aozora.client_secret', '');
        $verifySig = filter_var(config('services.gmo_aozora.webhook_verify_signature', false), FILTER_VALIDATE_BOOLEAN);
        $verifyTok = filter_var(config('services.gmo_aozora.webhook_verify_access_token', true), FILTER_VALIDATE_BOOLEAN);
        $eventType = (string) $request->header('x-eventType', 'va-deposit-transaction');
        $payload   = json_decode($body, true);
        $messageId = is_array($payload) ? (string) ($payload['messageId'] ?? '') : '';

        $respond = function (int $status, string $message, array $log = []) use ($request, $eventType, $messageId): JsonResponse {
            $this->gate->logInbound([
                'context'    => 'webhook:' . $eventType,
                'method'     => 'POST',
                'url'        => $request->path(),
                'status'     => $status,
                'result'     => $message,
                'message_id' => $messageId !== '' ? $messageId : null,
                'remote_ip'  => $request->ip(),
            ] + $log);
            $response = response()->json(['message' => $message], $status);
            if ($status === 401) {
                $response->header('WWW-Authenticate', 'Basic realm="gmo-aozora-webhook"');
            }
            return $response;
        };

        // [接続試験用デバッグ] 認証より前に生データを残す（gmo_aozora_webhook_debug=true のときだけ）
        if (SystemSetting::get('gmo_aozora_webhook_debug', false)) {
            Log::info('GMO Aozora webhook raw receive [debug]', [
                'ip'      => $request->ip(),
                'headers' => [
                    'Authorization'       => $request->header('Authorization') ? '(present)' : null,
                    'x-webhook-signature' => $request->header('x-webhook-signature'),
                    'x-eventType'         => $eventType,
                    'x-access-token'      => $request->header('x-access-token') ? '(present)' : null,
                    'User-Agent'          => $request->header('User-Agent'),
                    'Content-Type'        => $request->header('Content-Type'),
                ],
                'body' => $body,
            ]);
        }

        // 0. 未設定は誤配線 → 5xx で気付けるようにする
        if ($basicUser === '' || $basicPass === '') {
            Log::error('GMO Aozora webhook basic auth is not configured');
            return $respond(500, 'server not configured');
        }

        // 1. Basic 認証（タイミングセーフ比較）
        $reqUser = (string) $request->getUser();
        $reqPass = (string) $request->getPassword();
        if (!hash_equals($basicUser, $reqUser) || !hash_equals($basicPass, $reqPass)) {
            Log::warning('GMO Aozora webhook basic auth mismatch', ['ip' => $request->ip(), 'user' => $reqUser]);
            return $respond(401, 'unauthorized', ['reason' => 'basic_auth']);
        }

        // 2. アクセストークン一致（仕様書 イベント通知編 ＜セキュリティ対策＞ アクセストークン）
        if ($verifyTok) {
            $token = $this->oauth->token();
            if (!$token) {
                Log::warning('GMO Aozora webhook received before authorization (no stored token)');
                return $respond(401, 'unauthorized', ['reason' => 'no_token']);
            }
            if (!$token->matchesAccessToken((string) $request->header('x-access-token', ''))) {
                Log::warning('GMO Aozora webhook access token mismatch', ['ip' => $request->ip()]);
                return $respond(401, 'unauthorized', ['reason' => 'access_token']);
            }
        }

        // 3. 署名検証（有効化した場合のみ。HMAC-SHA256(body, client_secret) → Base64）
        if ($verifySig) {
            if ($secret === '') {
                Log::error('GMO Aozora webhook signature verification enabled but client_secret is empty');
                return $respond(500, 'server not configured');
            }
            $expected  = base64_encode(hash_hmac('sha256', $body, $secret, true));
            $signature = (string) $request->header('x-webhook-signature', '');
            if ($signature === '' || !hash_equals($expected, $signature)) {
                Log::warning('GMO Aozora webhook signature mismatch', ['ip' => $request->ip()]);
                return $respond(401, 'invalid signature', ['reason' => 'signature']);
            }
        }

        // 4. イベント種別（対象外は受理だけして 200）
        if ($eventType !== 'va-deposit-transaction') {
            Log::info('GMO Aozora webhook ignored event type', ['event_type' => $eventType]);
            return $respond(200, 'ignored');
        }

        if (!is_array($payload) || $messageId === '') {
            return $respond(400, 'missing messageId');
        }
        $payload['eventType'] = $eventType;

        // 5. 有効化トグル（OFF のときは受理だけして本処理しない = 疎通確認用）
        if (!SystemSetting::get('gmo_aozora_webhook_enabled', false)) {
            Log::info('GMO Aozora webhook received but integration disabled', ['message_id' => $messageId]);
            return $respond(200, 'integration disabled');
        }

        // 6. 冪等: 同一 messageId が既に届いていれば 200（再送抑止）
        $notification = $this->ingest->ingestWebhook($payload, $body);
        if (!$notification) {
            return $respond(200, 'already processed');
        }

        // 7. 本処理は非同期化して即 200。dispatch 失敗時は行を消して 5xx（GMO の再送でやり直させる）
        try {
            ProcessGmoDepositNotificationJob::dispatch($notification->id);
        } catch (\Throwable $e) {
            $notification->delete();
            Log::error('GMO Aozora webhook dispatch failed', [
                'message_id' => $messageId,
                'error'      => $e->getMessage(),
            ]);
            return $respond(500, 'dispatch failed');
        }

        return $respond(200, 'accepted'); // 仕様: 成功は 200 のみ
    }
}
