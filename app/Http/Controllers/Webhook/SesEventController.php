<?php

namespace App\Http\Controllers\Webhook;

use Aws\Sns\Message;
use Aws\Sns\MessageValidator;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * SES → SNS → ここ という流れで送られてくる、バウンス/苦情通知を受け取る Webhook。
 *
 * フロー:
 * 1. SNS が SubscriptionConfirmation を送ってくる → SubscribeURL を GET して購読確認
 * 2. 以降は Notification (Bounce/Complaint) が来る → 該当ユーザーの状態を更新
 *
 * 署名検証は aws/aws-php-sns-message-validator で行い、Topic ARN も config('services.ses.sns_topic_arns')
 * のホワイトリストと照合する。
 */
class SesEventController extends Controller
{
    public function bounce(Request $request): JsonResponse
    {
        return $this->handle($request, 'bounce');
    }

    public function complaint(Request $request): JsonResponse
    {
        return $this->handle($request, 'complaint');
    }

    private function handle(Request $request, string $expectedType): JsonResponse
    {
        try {
            $message = Message::fromRawPostData();
        } catch (\Throwable $e) {
            Log::warning('SES webhook: invalid SNS payload', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'invalid payload'], 400);
        }

        $validator = new MessageValidator();
        if (!$validator->isValid($message)) {
            Log::warning('SES webhook: SNS signature validation failed');
            return response()->json(['error' => 'invalid signature'], 403);
        }

        $allowedArns = config('services.ses.sns_topic_arns', []);
        if (!empty($allowedArns) && !in_array($message['TopicArn'] ?? null, $allowedArns, true)) {
            Log::warning('SES webhook: unauthorized topic ARN', ['topic_arn' => $message['TopicArn'] ?? null]);
            return response()->json(['error' => 'unauthorized topic'], 403);
        }

        $type = $message['Type'] ?? null;

        // SNS の購読確認は SubscribeURL を一度 GET すれば確定する
        if ($type === 'SubscriptionConfirmation') {
            $subscribeUrl = $message['SubscribeURL'] ?? null;
            if ($subscribeUrl) {
                Http::timeout(5)->get($subscribeUrl);
                Log::info('SES webhook: SNS subscription confirmed', ['topic_arn' => $message['TopicArn'] ?? null]);
            }
            return response()->json(['ok' => true]);
        }

        if ($type !== 'Notification') {
            return response()->json(['ok' => true]);
        }

        $payload = json_decode($message['Message'] ?? '', true);
        if (!is_array($payload)) {
            Log::warning('SES webhook: notification body is not JSON');
            return response()->json(['error' => 'invalid notification body'], 400);
        }

        $notificationType = $payload['notificationType'] ?? $payload['eventType'] ?? null;

        if ($expectedType === 'bounce' && $notificationType === 'Bounce') {
            $this->processBounce($payload);
        } elseif ($expectedType === 'complaint' && $notificationType === 'Complaint') {
            $this->processComplaint($payload);
        } else {
            Log::info('SES webhook: ignored notification type', [
                'expected' => $expectedType,
                'actual' => $notificationType,
            ]);
        }

        return response()->json(['ok' => true]);
    }

    private function processBounce(array $payload): void
    {
        // ハードバウンスのみ永続的失敗として扱う。Transient (一時的) は除外しない
        $bounceType = $payload['bounce']['bounceType'] ?? null;
        if ($bounceType !== 'Permanent') {
            return;
        }

        $recipients = $payload['bounce']['bouncedRecipients'] ?? [];
        foreach ($recipients as $r) {
            $email = $r['emailAddress'] ?? null;
            if (!$email) continue;

            $updated = User::where('email', $email)
                ->whereNull('email_bounced_at')
                ->update(['email_bounced_at' => now()]);

            if ($updated) {
                Log::info('SES webhook: marked email as bounced', ['email' => $email]);
            }
        }
    }

    private function processComplaint(array $payload): void
    {
        $recipients = $payload['complaint']['complainedRecipients'] ?? [];
        foreach ($recipients as $r) {
            $email = $r['emailAddress'] ?? null;
            if (!$email) continue;

            $updated = User::where('email', $email)
                ->whereNull('email_complained_at')
                ->update(['email_complained_at' => now()]);

            if ($updated) {
                Log::warning('SES webhook: marked email as complained', ['email' => $email]);
            }
        }
    }
}
