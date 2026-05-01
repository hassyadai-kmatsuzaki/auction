<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Auth\Concerns\EnforcesSingleSession;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class LoginController extends Controller
{
    use EnforcesSingleSession;

    /**
     * ログイン
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        // ユーザーが存在しない、またはパスワードが一致しない
        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'メールアドレスまたはパスワードが正しくありません。ご確認のうえ再度お試しください。',
            ], 401);
        }

        // アカウント状態チェック
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

        $forceLogoutOthers = $request->boolean('force_logout_others');

        // 2FA が有効な場合はコード入力を要求（ここではまだトークン発行しないので
        // 多重ログインチェックは TwoFactorController.verify 側で再判定する）
        if ($user->two_factor_confirmed_at) {
            return response()->json([
                'success' => true,
                'data' => [
                    'two_factor_required' => true,
                    'user_id' => $user->id,
                ],
            ]);
        }

        // 多重ログイン抑止: 他端末で生きているトークンがあれば 409 で返し、
        // SPA に確認モーダルを出させてから force_logout_others=true で再送してもらう。
        if (! $forceLogoutOthers && $this->hasActiveAuthToken($user)) {
            return $this->alreadyLoggedInResponse($user->id);
        }

        if ($forceLogoutOthers) {
            $this->revokeOtherSessionsAndNotify($user, $request);
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
                    'payment_method_preference' => $user->payment_method_preference,
                    'bank_transfer_confirmed_at' => $user->bank_transfer_confirmed_at,
                    'roles' => $user->roles->map(function ($role) {
                        return [
                            'id' => $role->id,
                            'name' => $role->name,
                            'display_name' => $role->display_name,
                        ];
                    }),
                ],
                'token' => $token,
            ],
        ]);
    }

    /**
     * ログアウト
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function logout(Request $request)
    {
        $user = $request->user();
        $token = $user?->currentAccessToken();
        if ($token) {
            $token->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'ログアウトしました',
        ]);
    }

    /**
     * 認証ユーザー情報取得
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function me(Request $request)
    {
        $user = $request->user();

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
                    'payment_method_preference' => $user->payment_method_preference,
                    'bank_transfer_confirmed_at' => $user->bank_transfer_confirmed_at,
                    'roles' => $user->roles->map(function ($role) {
                        return [
                            'id' => $role->id,
                            'name' => $role->name,
                            'display_name' => $role->display_name,
                        ];
                    }),
                    'seller_profile' => $user->sellerProfile,
                ],
            ],
        ]);
    }
}
