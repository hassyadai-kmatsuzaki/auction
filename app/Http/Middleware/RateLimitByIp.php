<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class RateLimitByIp
{
    /**
     * B-3 (2026-09-08): $maxAttempts に数値以外（設定キー名）を渡すと system_settings から上限を読む。
     *   例: 'rate.limit:auth_rate_limit_per_minute,1'
     *   認証系の入口は送信元 IP ごと 1分10回で、同一回線（店舗・家族・キャリア CGNAT）から
     *   11人目以降が同じ分にログインすると 429 になる。開催当日だけ管理画面から緩められるよう、
     *   経路定義に数値を埋め込まず、判定時に設定を読む（route:cache の再生成なしで反映される）。
     *   設定が無ければ既定 10。
     */
    public function handle(Request $request, Closure $next, int|string $maxAttempts = 60, int $decayMinutes = 1): Response
    {
        if (!is_numeric($maxAttempts)) {
            $maxAttempts = (int) \App\Models\SystemSetting::get($maxAttempts, 10);
        }
        $maxAttempts = max(1, (int) $maxAttempts);

        $key = 'rate_limit:' . $request->ip() . ':' . $request->path();
        $attempts = (int) Cache::get($key, 0);

        if ($attempts >= $maxAttempts) {
            return response()->json([
                'success' => false,
                'message' => 'リクエスト数が上限を超えました。しばらくしてから再度お試しください。',
            ], 429);
        }

        Cache::put($key, $attempts + 1, now()->addMinutes($decayMinutes));

        $response = $next($request);

        $response->headers->set('X-RateLimit-Limit', (string) $maxAttempts);
        $response->headers->set('X-RateLimit-Remaining', (string) max(0, $maxAttempts - $attempts - 1));

        return $response;
    }
}
