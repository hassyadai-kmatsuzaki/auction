<?php

namespace App\Http\Controllers\GmoAozora;

use App\Http\Controllers\Controller;
use App\Services\GmoAozora\GmoAozoraApiException;
use App\Services\GmoAozora\GmoAozoraOAuthService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * GMOあおぞら OAuth 認可コールバック（ブラウザからリダイレクトされる・認証なし）。
 *
 * ヒアリングシート Q10/Q11 に登録した redirect_uri がここ。
 * state はキャッシュで10分・1回限り。成功/失敗ともフロントの管理画面へ戻す。
 */
class OAuthCallbackController extends Controller
{
    public function __construct(private readonly GmoAozoraOAuthService $oauth)
    {
    }

    public function callback(Request $request)
    {
        $state = (string) $request->query('state', '');
        $code  = (string) $request->query('code', '');
        $error = (string) $request->query('error', '');

        if (!$this->oauth->consumeState($state)) {
            Log::warning('GMO Aozora OAuth callback: invalid state', ['ip' => $request->ip()]);
            return $this->redirectToAdmin('error', 'invalid_state');
        }

        if ($error !== '' || $code === '') {
            Log::warning('GMO Aozora OAuth callback: authorization denied', [
                'error' => $error,
                'error_description' => $request->query('error_description'),
            ]);
            return $this->redirectToAdmin('error', $error !== '' ? $error : 'missing_code');
        }

        try {
            $this->oauth->exchangeAuthorizationCode($code);
        } catch (GmoAozoraApiException $e) {
            return $this->redirectToAdmin('error', $e->errorCode ?? 'token_exchange_failed');
        }

        return $this->redirectToAdmin('connected');
    }

    private function redirectToAdmin(string $result, ?string $reason = null)
    {
        $base = rtrim((string) config('app.frontend_url', ''), '/');
        $query = ['gmo_aozora' => $result];
        if ($reason) {
            $query['reason'] = mb_substr($reason, 0, 64);
        }
        return redirect()->away($base . '/admin/settings?' . http_build_query($query));
    }
}
