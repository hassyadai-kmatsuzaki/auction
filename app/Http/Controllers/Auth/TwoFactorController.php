<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\TwoFactorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TwoFactorController extends Controller
{
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
        ]);

        $user = \App\Models\User::findOrFail($request->user_id);

        // リカバリーコードでの認証
        if (strlen($request->code) > 6) {
            $valid = $this->twoFactorService->verifyRecoveryCode($user, $request->code);
        } else {
            $valid = $this->twoFactorService->verifyCode($user, $request->code);
        }

        if (!$valid) {
            return response()->json([
                'success' => false,
                'message' => '認証コードが正しくありません',
            ], 422);
        }

        // 最終ログイン日時を更新
        $user->update(['last_login_at' => now()]);

        // トークン発行
        $token = $user->createToken('auth-token')->plainTextToken;

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
