<?php

namespace App\Http\Controllers\Webhook;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessEneWebhookJob;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * E-NE（Cal-Connect）外部連携 Webhook 受信。
 *
 * 契約締結 → CRMワークフロー発火 → 当エンドポイントへ署名付きPOST → 承認済み会員を自動作成。
 * 仕様: 「E-NE 外部連携Webhook 受信仕様書 v1.0」
 *
 * 設計原則（ライブオークション非影響）:
 *   - 署名検証 → 冪等チェック → 即 202 を返し、本処理は notify キューの Job に委譲する。
 *   - 重い処理・DB書き込みの本体は同期で行わない（php-fpm ワーカーを掴まない）。
 */
class EneWebhookController extends Controller
{
    public function handle(Request $request)
    {
        $body   = $request->getContent();
        $secret = (string) config('services.ene.webhook_secret');

        // [一時デバッグ] 署名検証・トグルより前に、受信した生データをそのまま記録する。
        //   連携初期は署名ミスマッチで下の 401 に落ちて中身が見えないため、ここで拾う。
        //   個人情報が production.log に残るので ene_webhook_debug=true のときだけ出す。
        //   確認が済んだらトグルを false に戻すこと（コードは残しておいてよい）。
        if (SystemSetting::get('ene_webhook_debug', false)) {
            Log::info('ENE webhook raw receive [debug]', [
                'ip'      => $request->ip(),
                'headers' => [
                    'X-ENE-Signature' => $request->header('X-ENE-Signature'),
                    'X-ENE-Delivery'  => $request->header('X-ENE-Delivery'),
                    'Content-Type'    => $request->header('Content-Type'),
                    'User-Agent'      => $request->header('User-Agent'),
                ],
                'body'         => $body,
                'sig_expected' => $secret !== '' ? 'sha256=' . hash_hmac('sha256', $body, $secret) : null,
            ]);
        }

        // 0. 未設定は誤配線 → 5xx で気付けるようにする（正常時は .env に設定済みの前提）
        if ($secret === '') {
            Log::error('ENE webhook secret is not configured');
            return response()->json(['message' => 'server not configured'], 500);
        }

        // 1. 署名検証（受信した生ボディに対する HMAC-SHA256, タイミングセーフ比較）
        $expected = 'sha256=' . hash_hmac('sha256', $body, $secret);
        if (!hash_equals($expected, (string) $request->header('X-ENE-Signature', ''))) {
            Log::warning('ENE webhook signature mismatch', ['ip' => $request->ip()]);
            return response()->json(['message' => 'invalid signature'], 401);
        }

        $payload    = json_decode($body, true) ?: [];
        $event      = $payload['event'] ?? 'unknown';
        $deliveryId = $payload['delivery_id'] ?? $request->header('X-ENE-Delivery');

        // 2. テスト送信は本処理せず 200（会員登録はスキップ）
        if ($event === 'webhook.test') {
            return response()->json(['message' => 'test received']);
        }

        if (!$deliveryId) {
            return response()->json(['message' => 'missing delivery_id'], 400);
        }

        // 3. 有効化トグル（OFF のときは受理だけして本処理しない = 疎通確認用）
        if (!SystemSetting::get('ene_webhook_enabled', false)) {
            Log::info('ENE webhook received but integration disabled', ['delivery_id' => $deliveryId]);
            return response()->json(['message' => 'integration disabled']); // 200
        }

        // 4. 冪等: 同一 delivery_id が既に届いていれば 200（再送抑止）
        $exists = DB::table('ene_webhook_events')->where('delivery_id', $deliveryId)->exists();
        if ($exists) {
            return response()->json(['message' => 'already processed']); // 200
        }

        DB::table('ene_webhook_events')->insert([
            'delivery_id' => $deliveryId,
            'event'       => is_string($event) ? substr($event, 0, 50) : 'unknown',
            'payload'     => $body,
            'received_at' => now(),
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        // 5. 本処理は非同期化して即 202（仕様書§2: E-NE 側は 10 秒でタイムアウト）
        //    dispatch 失敗（redis 障害等）時は冪等行を残すと以後「処理済み」で握り潰されるため、
        //    行を消して 5xx を返し E-NE の再送でやり直させる（会員登録の取りこぼし防止）。
        try {
            ProcessEneWebhookJob::dispatch($deliveryId, $payload);
        } catch (\Throwable $e) {
            DB::table('ene_webhook_events')->where('delivery_id', $deliveryId)->delete();
            Log::error('ENE webhook dispatch failed', [
                'delivery_id' => $deliveryId,
                'error'       => $e->getMessage(),
            ]);
            return response()->json(['message' => 'dispatch failed'], 500);
        }

        return response()->json(['message' => 'accepted'], 202);
    }
}
