<?php

namespace App\Http\Controllers\Webhook;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Subscription;
use App\Services\Payment\SquareClient;
use App\Services\Payment\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Square Webhook 受信
 *
 * 受信対象 (Square 管理画面で購読するイベント):
 *   - payment.created  : 新規決済
 *   - payment.updated  : 決済状態変化（成功確定/失敗/refund 発生）
 *   - refund.updated   : 返金
 *
 * 仕様上、初回加入時は同期課金しているため webhook は補助。
 * 更新バッチが作った payment を Square 側で失敗通知が遅延して来た場合などに使う。
 */
class SquareWebhookController extends Controller
{
    public function __construct(
        private readonly SquareClient $square,
        private readonly SubscriptionService $subscriptionService,
    ) {}

    public function handle(Request $request)
    {
        $body      = $request->getContent();
        $signature = $request->header('X-Square-Hmacsha256-Signature', $request->header('x-square-hmacsha256-signature', ''));

        if (!$this->square->verifyWebhookSignature($body, (string) $signature)) {
            Log::warning('Square webhook signature mismatch', [
                'ip' => $request->ip(),
            ]);
            return response()->json(['success' => false, 'message' => 'invalid signature'], 401);
        }

        $payload = json_decode($body, true) ?: [];
        $eventId   = $payload['event_id']   ?? null;
        $eventType = $payload['type']       ?? 'unknown';

        if (!$eventId) {
            return response()->json(['success' => false, 'message' => 'missing event_id'], 400);
        }

        // 冪等保存
        $record = DB::table('square_webhook_events')->where('event_id', $eventId)->first();
        if ($record) {
            // 既処理 → 200 OK（Square の再送抑止）
            return response()->json(['success' => true, 'message' => 'already processed']);
        }

        $id = DB::table('square_webhook_events')->insertGetId([
            'event_id'   => $eventId,
            'event_type' => $eventType,
            'payload'    => $body,
            'received_at'=> now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            match ($eventType) {
                'payment.created', 'payment.updated' => $this->handlePaymentEvent($payload),
                'refund.created', 'refund.updated'   => $this->handleRefundEvent($payload),
                default => Log::info('Square webhook (ignored)', ['type' => $eventType]),
            };

            DB::table('square_webhook_events')->where('id', $id)->update([
                'processed_at' => now(),
                'updated_at'   => now(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Square webhook processing failed', [
                'event_id' => $eventId,
                'type'     => $eventType,
                'error'    => $e->getMessage(),
            ]);
            DB::table('square_webhook_events')->where('id', $id)->update([
                'processing_error' => \Illuminate\Support\Str::limit($e->getMessage(), 1000),
                'updated_at'       => now(),
            ]);
            // 200 を返すと Square は再送しないので、5xx を返して再送させる
            return response()->json(['success' => false, 'message' => 'processing error'], 500);
        }

        return response()->json(['success' => true]);
    }

    private function handlePaymentEvent(array $payload): void
    {
        $object = $payload['data']['object']['payment'] ?? null;
        if (!$object) return;

        $squarePaymentId = $object['id'] ?? null;
        $status          = $object['status'] ?? null;
        if (!$squarePaymentId) return;

        $payment = Payment::where('square_payment_id', $squarePaymentId)->first();

        // まだ DB に該当がなければ 相関できない
        if (!$payment) {
            Log::info('Square webhook: unknown payment', ['square_payment_id' => $squarePaymentId]);
            return;
        }

        if ($status === 'COMPLETED' || $status === 'APPROVED') {
            if ($payment->status !== Payment::STATUS_COMPLETED) {
                $payment->update([
                    'status'  => Payment::STATUS_COMPLETED,
                    'paid_at' => $payment->paid_at ?: now(),
                    'raw_response' => array_merge($payment->raw_response ?? [], ['webhook' => $object]),
                ]);
            }
        } elseif (in_array($status, ['FAILED', 'CANCELED'], true)) {
            if ($payment->status !== Payment::STATUS_FAILED) {
                $payment->update([
                    'status'         => Payment::STATUS_FAILED,
                    'failed_at'      => now(),
                    'failure_reason' => 'webhook: ' . $status,
                    'raw_response'   => array_merge($payment->raw_response ?? [], ['webhook' => $object]),
                ]);

                if ($payment->subscription_id) {
                    $subscription = Subscription::find($payment->subscription_id);
                    if ($subscription) {
                        $this->subscriptionService->markSuspended($subscription, 'Square webhook: ' . $status);
                    }
                }
            }
        }
    }

    private function handleRefundEvent(array $payload): void
    {
        $object = $payload['data']['object']['refund'] ?? null;
        if (!$object) return;

        $squarePaymentId = $object['payment_id'] ?? null;
        if (!$squarePaymentId) return;

        $payment = Payment::where('square_payment_id', $squarePaymentId)->first();
        if (!$payment) return;

        $refundAmount = (int) ($object['amount_money']['amount'] ?? 0);
        $status = $object['status'] ?? null;

        if ($status === 'COMPLETED') {
            $payment->update([
                'status'          => Payment::STATUS_REFUNDED,
                'refunded_at'     => now(),
                'refunded_amount' => $refundAmount,
                'raw_response'    => array_merge($payment->raw_response ?? [], ['refund_webhook' => $object]),
            ]);
        }
    }
}
