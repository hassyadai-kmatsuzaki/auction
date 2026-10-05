<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Auth\Concerns\EnforcesSingleSession;
use App\Http\Controllers\Controller;
use App\Services\ActivityLogger;
use App\Services\TwoFactorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TwoFactorController extends Controller
{
    use EnforcesSingleSession;

    public function __construct(
        private TwoFactorService $twoFactorService,
    ) {}

    /**
     * 2FA有効化の準備（QRコード生成）
     */
    public function setup(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->two_factor_confirmed_at) {
            return response()->json([
                'success' => false,
                'message' => '二段階認証は既に有効です',
            ], 422);
        }

        $result = $this->twoFactorService->generateSecret($user);

        return response()->json([
            'success' => true,
            'data' => [
                'qr_code_url' => $result['qr_code_url'],
                'secret' => $result['secret'],
                'recovery_codes' => $result['recovery_codes'],
            ],
        ]);
    }

    /**
     * 2FAの有効化を確認（コード検証）
     */
    public function confirm(Request $request): JsonResponse
    {
        $request->validate([
            'code' => 'required|string|size:6',
        ]);

        $user = $request->user();

        if ($user->two_factor_confirmed_at) {
            return response()->json([
                'success' => false,
                'message' => '二段階認証は既に有効です',
            ], 422);
        }

        if (!$user->two_factor_secret) {
            return response()->json([
                'success' => false,
                'message' => '先にセットアップを実行してください',
            ], 422);
        }

        $valid = $this->twoFactorService->verifyCode($user, $request->code);

        if (!$valid) {
            return response()->json([
                'success' => false,
                'message' => '認証コードが正しくありません',
            ], 422);
        }

        $user->update(['two_factor_confirmed_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => '二段階認証が有効になりました',
        ]);
    }

    /**
     * 2FAを無効化
     */
    public function disable(Request $request): JsonResponse
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        $user = $request->user();

        if (!$user->two_factor_confirmed_at) {
            return response()->json([
                'success' => false,
                'message' => '二段階認証は有効ではありません',
            ], 422);
        }

        if (!\Illuminate\Support\Facades\Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'パスワードが正しくありません',
            ], 422);
        }

        $user->update([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => '二段階認証を無効にしました',
        ]);
    }

    /**
     * 2FAステータス確認
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'success' => true,
            'data' => [
                'enabled' => (bool) $user->two_factor_confirmed_at,
                'confirmed_at' => $user->two_factor_confirmed_at,
            ],
        ]);
    }

    /**
     * ログイン時の2FA検証
     */
    public function verify(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => 'required|integer',
            'code' => 'required|string',
            'two_factor_token' => 'nullable|string',
        ]);

        // パスワード確認済みの証明（ログイン時に発行したチャレンジ）が無ければ受け付けない。
        // user_id と6桁コードだけで通すと、パスワードを知らなくてもコード総当たりでログインできてしまう
        $challenge = (string) $request->input('two_factor_token', '');
        if (!$this->twoFactorService->isValidLoginChallenge($challenge, (int) $request->user_id)) {
            return response()->json([
                'success' => false,
                'code' => 'TWO_FACTOR_CHALLENGE_EXPIRED',
                'message' => '認証の有効期限が切れました。お手数ですが、もう一度ログインからやり直してください。',
            ], 422);
        }

        $user = \App\Models\User::findOrFail($request->user_id);

        // リカバリーコードでの認証
        if (strlen($request->code) > 6) {
            $valid = $this->twoFactorService->verifyRecoveryCode($user, $request->code);
        } else {
            $valid = $this->twoFactorService->verifyCode($user, $request->code);
        }

        if (!$valid) {
            $this->twoFactorService->recordFailedLoginChallenge($challenge);
            return response()->json([
                'success' => false,
                'message' => '認証コードが正しくありません',
            ], 422);
        }

        // アカウント状態チェック（LoginController と同じ）。パスワード入力の後に停止された人へトークンを出さない。
        if ($user->status !== 'approved') {
            $messages = [
                'pending'   => '現在、アカウントの承認待ちです。運営による承認が完了次第、ログインいただけます。承認には数営業日かかる場合があります。お急ぎの場合は info@nep-corp.com までご連絡ください。',
                'rejected'  => '申し訳ございません。アカウントの承認が見送られました。詳しくは info@nep-corp.com までお問い合わせください。',
                'suspended' => 'このアカウントは現在ご利用を停止しています。詳しくは info@nep-corp.com までお問い合わせください。',
            ];
            return response()->json([
                'success' => false,
                'message' => $messages[$user->status] ?? 'このアカウントは現在ログインできません。詳しくは info@nep-corp.com までお問い合わせください。',
            ], 403);
        }

        if (!$user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'このアカウントは現在無効化されています。詳しくは info@nep-corp.com までお問い合わせください。',
            ], 403);
        }

        // 多重ログイン抑止（LoginController と同じロジック）
        $forceLogoutOthers = $request->boolean('force_logout_others');
        if (! $forceLogoutOthers && $this->hasActiveAuthToken($user)) {
            return $this->alreadyLoggedInResponse($user->id);
        }

        if ($forceLogoutOthers) {
            $this->revokeOtherSessionsAndNotify($user, $request);
        }

        // 最終ログイン日時を更新
        $user->update(['last_login_at' => now()]);

        // トークン発行。チャレンジは使い切り（409 の確認モーダル経由の再送では残しておく必要があるので、ここで消す）
        $token = $user->createToken('auth-token')->plainTextToken;
        $this->twoFactorService->clearLoginChallenge($challenge);

        // 計測: ログイン（2FA 経由）
        ActivityLogger::login($user->id);

        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'status' => $user->status,
                    'phone' => $user->phone,
                    'postal_code' => $user->postal_code,
                    'prefecture' => $user->prefecture,
                    'city' => $user->city,
                    'address_line1' => $user->address_line1,
                    'address_line2' => $user->address_line2,
                    'roles' => $user->roles->map(fn($role) => [
                        'id' => $role->id,
                        'name' => $role->name,
                        'display_name' => $role->display_name,
                    ]),
                ],
                'token' => $token,
            ],
        ]);
    }

    /**
     * リカバリーコードの再生成
     */
    public function regenerateRecoveryCodes(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->two_factor_confirmed_at) {
            return response()->json([
                'success' => false,
                'message' => '二段階認証が有効ではありません',
            ], 422);
        }

        $codes = $this->twoFactorService->generateRecoveryCodes();

        $user->update([
            'two_factor_recovery_codes' => encrypt(json_encode($codes)),
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'recovery_codes' => $codes,
            ],
        ]);
    }
}
