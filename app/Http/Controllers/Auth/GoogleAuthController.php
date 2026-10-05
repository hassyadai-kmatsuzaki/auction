<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Auth\Concerns\EnforcesSingleSession;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\TwoFactorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class GoogleAuthController extends Controller
{
    use EnforcesSingleSession;

    /** コールバックから画面へ渡す使い切りコードの有効期限（秒） */
    private const HANDOFF_TTL_SECONDS = 120;

    /**
     * Google OAuth リダイレクトURL生成
     */
    public function redirect(Request $request): JsonResponse
    {
        abort_unless(config('features.google_login'), 404);

        $state = Str::random(40);
        Cache::put("google_oauth_state:{$state}", true, 600);

        $params = http_build_query([
            'client_id' => config('services.google.client_id'),
            'redirect_uri' => config('services.google.redirect'),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'access_type' => 'offline',
            'prompt' => 'select_account',
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'url' => "https://accounts.google.com/o/oauth2/v2/auth?{$params}",
            ],
        ]);
    }

    /**
     * Google OAuth コールバック処理
     */
    public function callback(Request $request)
    {
        if (!config('features.google_login')) {
            return $this->redirectWithError('Googleログインは現在ご利用いただけません');
        }

        $state = $request->query('state');
        $code = $request->query('code');

        if (!$state || !Cache::pull("google_oauth_state:{$state}")) {
            return $this->redirectWithError('不正なリクエストです');
        }

        if (!$code) {
            return $this->redirectWithError('認証がキャンセルされました');
        }

        try {
            // アクセストークン取得
            $tokenResponse = Http::asForm()->post('https://oauth2.googleapis.com/token', [
                'client_id' => config('services.google.client_id'),
                'client_secret' => config('services.google.client_secret'),
                'code' => $code,
                'grant_type' => 'authorization_code',
                'redirect_uri' => config('services.google.redirect'),
            ]);

            if (!$tokenResponse->successful()) {
                return $this->redirectWithError('トークン取得に失敗しました');
            }

            $accessToken = $tokenResponse->json('access_token');

            // ユーザー情報取得
            $userResponse = Http::withToken($accessToken)
                ->get('https://www.googleapis.com/oauth2/v2/userinfo');

            if (!$userResponse->successful()) {
                return $this->redirectWithError('ユーザー情報の取得に失敗しました');
            }

            $googleUser = $userResponse->json();
            $email = $googleUser['email'] ?? null;
            $name = $googleUser['name'] ?? '';

            if (!$email) {
                return $this->redirectWithError('メールアドレスが取得できませんでした');
            }

            // 既存ユーザーの検索またはGoogle IDで紐付け
            $user = User::where('email', $email)->first();

            if ($user) {
                // 既存ユーザー: ステータスチェック
                if (!$user->is_active) {
                    return $this->redirectWithError('このアカウントは現在無効化されています。詳しくは info@nep-corp.com までお問い合わせください。');
                }
                if ($user->status !== 'approved') {
                    $messages = [
                        'pending'   => '現在、アカウントの承認待ちです。運営による承認が完了次第、ログインいただけます。承認には数営業日かかる場合があります。お急ぎの場合は info@nep-corp.com までご連絡ください。',
                        'rejected'  => '申し訳ございません。アカウントの承認が見送られました。詳しくは info@nep-corp.com までお問い合わせください。',
                        'suspended' => 'このアカウントは現在ご利用を停止しています。詳しくは info@nep-corp.com までお問い合わせください。',
                    ];
                    return $this->redirectWithError($messages[$user->status] ?? 'このアカウントは現在ログインできません。詳しくは info@nep-corp.com までお問い合わせください。');
                }

                $user->update(['google_id' => $googleUser['id']]);
            } else {
                // 新規ユーザー作成（承認待ち）
                $user = User::create([
                    'name' => $name,
                    'email' => $email,
                    'google_id' => $googleUser['id'],
                    'password' => bcrypt(Str::random(32)),
                    'status' => 'pending',
                    'is_active' => true,
                ]);

                // participant ロールを付与
                $participantRole = \App\Models\Role::where('name', 'participant')->first();
                if ($participantRole) {
                    $user->roles()->attach($participantRole->id, [
                        'assigned_at' => now(),
                    ]);
                }

                // 新規登録の場合は承認待ちページに戻す
                $frontendUrl = config('app.frontend_url', 'http://localhost:5173');
                return redirect("{$frontendUrl}/register?google_pending=1");
            }

            // ここではトークンを発行しない（URL に載せると履歴等から漏れるため）。
            // 使い切りコードだけを渡し、画面側が exchange で受け取るときに2FA・多重ログインを判定する
            $handoff = Str::random(64);
            Cache::put($this->handoffKey($handoff), $user->id, self::HANDOFF_TTL_SECONDS);

            $frontendUrl = config('app.frontend_url', 'http://localhost:5173');
            return redirect("{$frontendUrl}/auth/google-callback?code={$handoff}");
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Google OAuth error', ['error' => $e->getMessage()]);
            return $this->redirectWithError('認証処理中にエラーが発生しました');
        }
    }

    /**
     * コールバックで受け取った使い切りコードをトークンに交換する。
     * 通常ログインと同じく、2FA が有効なら2段階目へ、他端末ログイン中なら 409 で確認を挟む
     */
    public function exchange(Request $request, TwoFactorService $twoFactor): JsonResponse
    {
        abort_unless(config('features.google_login'), 404);
        $request->validate(['code' => 'required|string']);

        $key = $this->handoffKey($request->input('code'));
        $user = ($userId = Cache::get($key)) ? User::find($userId) : null;
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'ログインの有効期限が切れました。もう一度お試しください。'], 422);
        }
        if (!$user->is_active || $user->status !== 'approved') {
            Cache::forget($key);
            return response()->json(['success' => false, 'message' => 'このアカウントは現在ログインできません。詳しくは info@nep-corp.com までお問い合わせください。'], 403);
        }

        if ($user->two_factor_confirmed_at) {
            Cache::forget($key);
            return response()->json([
                'success' => true,
                'data' => [
                    'two_factor_required' => true,
                    'user_id' => $user->id,
                    'two_factor_token' => $twoFactor->issueLoginChallenge($user),
                ],
            ]);
        }

        // 409 の確認モーダル経由で force_logout_others=true の再送が来るので、ここではコードを残す
        $forceLogoutOthers = $request->boolean('force_logout_others');
        if (!$forceLogoutOthers && $this->hasActiveAuthToken($user)) {
            return $this->alreadyLoggedInResponse($user->id);
        }
        if ($forceLogoutOthers) {
            $this->revokeOtherSessionsAndNotify($user, $request);
        }

        Cache::forget($key);
        $user->update(['last_login_at' => now()]);
        $token = $user->createToken('auth-token')->plainTextToken;

        // 計測: ログイン（管理画面のログイン履歴もこのイベントを見ている）
        ActivityLogger::login($user->id);

        return response()->json(['success' => true, 'data' => ['token' => $token]]);
    }

    private function handoffKey(string $code): string
    {
        return 'google_login_handoff:' . hash('sha256', $code);
    }

    private function redirectWithError(string $message)
    {
        $frontendUrl = config('app.frontend_url', 'http://localhost:5173');
        return redirect("{$frontendUrl}/login?error=" . urlencode($message));
    }
}
