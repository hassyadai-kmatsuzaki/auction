<?php

namespace App\Http\Middleware;

use App\Models\SystemSetting;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class RateLimitByIp
{
    /** R1: 認証系の「送信元 IP ごと」の天井を持つ設定キーと既定値 */
    public const IP_CEILING_KEY     = 'auth_rate_limit_per_ip_per_minute';
    public const IP_CEILING_DEFAULT = 600;

    /**
     * アカウントを特定する入力項目（先に見つかったものを使う）。
     *   email   … login / register / forgot-password / reset-password
     *   token   … verify-token / set-password（招待・再設定トークン）
     *   user_id … two-factor/verify
     */
    private const ACCOUNT_FIELDS = ['email', 'token', 'user_id'];

    /**
     * B-3 (2026-09-08): $maxAttempts に数値以外（設定キー名）を渡すと system_settings から上限を読む。
     *   例: 'rate.limit:auth_rate_limit_per_minute,1'
     *   経路定義に数値を埋め込まず、判定時に設定を読む（route:cache の再生成なしで反映される）。
     *
     * R1 (2026-09-14): 設定キー指定のときは二段構えにする。
     *   1. アカウント単位（email / token / user_id のいずれか、パスごと）… 設定キーの値（既定 10）
     *   2. 送信元 IP 単位（パスごと）… auth_rate_limit_per_ip_per_minute（既定 600、アカウント単位を下回らない）
     *   9/20 は参加者 500 名が会場の 1 回線から来るため、IP 単位 10 では 11 人目から 429 になる。
     *   総当たりの守りはアカウント単位で保ち、IP 単位は「同じ回線から来る人数」を許す天井にする。
     *   アカウント項目が無い経路（Google OAuth の redirect/callback）は IP の天井だけで見る。
     *   数値指定（webhooks など）は従来どおり IP 単位のみ。
     */
    public function handle(Request $request, Closure $next, int|string $maxAttempts = 60, int $decayMinutes = 1): Response
    {
        $path  = $request->path();
        $ipKey = 'rate_limit:' . $request->ip() . ':' . $path;

        // [キャッシュキー => 上限]。先頭が IP 単位、あればアカウント単位が続く
        $limits = [];
        if (is_numeric($maxAttempts)) {
            $limits[$ipKey] = max(1, (int) $maxAttempts);
        } else {
            $perAccount     = max(1, (int) SystemSetting::get($maxAttempts, 10));
            $perIp          = max($perAccount, (int) SystemSetting::get(self::IP_CEILING_KEY, self::IP_CEILING_DEFAULT));
            $limits[$ipKey] = $perIp;

            $account = $this->accountKey($request);
            if ($account !== null) {
                $limits['rate_limit:acct:' . $path . ':' . $account] = $perAccount;
            }
        }

        $attempts = [];
        foreach ($limits as $key => $max) {
            $attempts[$key] = (int) Cache::get($key, 0);
            if ($attempts[$key] >= $max) {
                return response()->json([
                    'success' => false,
                    'message' => 'リクエスト数が上限を超えました。しばらくしてから再度お試しください。',
                ], 429);
            }
        }

        $expiresAt = now()->addMinutes($decayMinutes);
        foreach ($limits as $key => $max) {
            Cache::put($key, $attempts[$key] + 1, $expiresAt);
        }

        $response = $next($request);

        // ヘッダは残りが少ない方の枠を返す
        $limit = null;
        $remaining = null;
        foreach ($limits as $key => $max) {
            $left = max(0, $max - $attempts[$key] - 1);
            if ($remaining === null || $left < $remaining) {
                $remaining = $left;
                $limit     = $max;
            }
        }
        $response->headers->set('X-RateLimit-Limit', (string) $limit);
        $response->headers->set('X-RateLimit-Remaining', (string) $remaining);

        return $response;
    }

    /**
     * アカウント単位キーの識別子。入力に email / token / user_id が無ければ null（IP の天井だけで見る）。
     * 大文字小文字と前後の空白を揃えてからハッシュ化し、メールアドレスをキャッシュキーに残さない。
     */
    private function accountKey(Request $request): ?string
    {
        foreach (self::ACCOUNT_FIELDS as $field) {
            $value = $request->input($field);
            if (is_scalar($value) && trim((string) $value) !== '') {
                return sha1($field . ':' . mb_strtolower(trim((string) $value)));
            }
        }

        return null;
    }
}
