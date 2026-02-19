<?php

namespace App\Services;

use App\Models\LineAccount;
use App\Models\LineNotificationLog;
use App\Models\LineNotificationSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LineService
{
    private string $channelAccessToken;
    private string $loginChannelId;
    private string $loginChannelSecret;
    private string $loginRedirectUri;

    public function __construct()
    {
        $this->channelAccessToken  = config('services.line.messaging_token', '');
        $this->loginChannelId      = config('services.line.login_channel_id', '');
        $this->loginChannelSecret  = config('services.line.login_channel_secret', '');
        $this->loginRedirectUri    = config('services.line.login_redirect_uri', '');
    }

    // ─── LINE Login ──────────────────────────────────────────────

    /** LINE Login の認証URL を生成 */
    public function getLoginUrl(string $state): string
    {
        return 'https://access.line.me/oauth2/v2.1/authorize?' . http_build_query([
            'response_type' => 'code',
            'client_id'     => $this->loginChannelId,
            'redirect_uri'  => $this->loginRedirectUri,
            'state'         => $state,
            'scope'         => 'profile openid',
        ]);
    }

    /** 認証コードからアクセストークンを取得 */
    public function getAccessToken(string $code): ?array
    {
        $response = Http::asForm()->post('https://api.line.me/oauth2/v2.1/token', [
            'grant_type'    => 'authorization_code',
            'code'          => $code,
            'redirect_uri'  => $this->loginRedirectUri,
            'client_id'     => $this->loginChannelId,
            'client_secret' => $this->loginChannelSecret,
        ]);

        return $response->successful() ? $response->json() : null;
    }

    /** アクセストークンからプロフィール取得 */
    public function getProfile(string $accessToken): ?array
    {
        $response = Http::withToken($accessToken)->get('https://api.line.me/v2/profile');
        return $response->successful() ? $response->json() : null;
    }

    // ─── Messaging API ───────────────────────────────────────────

    /** Push Message を送信 */
    public function pushMessage(string $lineUserId, array $messages): bool
    {
        if (empty($this->channelAccessToken)) {
            Log::warning('LINE Messaging token not configured');
            return false;
        }

        $response = Http::withToken($this->channelAccessToken)
            ->post('https://api.line.me/v2/bot/message/push', [
                'to'       => $lineUserId,
                'messages' => $messages,
            ]);

        if (!$response->successful()) {
            Log::error('LINE push failed', [
                'lineUserId' => substr($lineUserId, 0, 10) . '...',
                'status'     => $response->status(),
                'body'       => $response->body(),
            ]);
        }

        return $response->successful();
    }

    /** テキストメッセージを送信 */
    public function pushText(string $lineUserId, string $text): bool
    {
        return $this->pushMessage($lineUserId, [['type' => 'text', 'text' => $text]]);
    }

    /** Flex Message を送信 */
    public function pushFlex(string $lineUserId, string $altText, array $flexContent): bool
    {
        return $this->pushMessage($lineUserId, [[
            'type'     => 'flex',
            'altText'  => $altText,
            'contents' => $flexContent,
        ]]);
    }

    // ─── 通知送信（統合） ────────────────────────────────────────

    /**
     * ユーザーにLINE通知を送信する
     * 連携済み + 通知設定ON の場合のみ送信
     */
    public function notify(int $userId, string $notificationType, string $text, ?array $flexContent = null): bool
    {
        $lineAccount = LineAccount::where('user_id', $userId)->where('is_active', true)->first();
        if (!$lineAccount) return false;

        if (!LineNotificationSetting::isEnabled($userId, $notificationType)) return false;

        $altText  = mb_substr(strip_tags($text), 0, 200);
        $messages = $flexContent
            ? [['type' => 'flex', 'altText' => $altText, 'contents' => $flexContent]]
            : [['type' => 'text', 'text' => $text]];

        $success = $this->pushMessage($lineAccount->line_user_id, $messages);

        LineNotificationLog::create([
            'user_id'           => $userId,
            'notification_type' => $notificationType,
            'line_user_id'      => $lineAccount->line_user_id,
            'message_payload'   => $messages,
            'status'            => $success ? 'sent' : 'failed',
            'error_message'     => $success ? null : 'Push API returned error',
            'sent_at'           => now(),
            'created_at'        => now(),
        ]);

        return $success;
    }
}
