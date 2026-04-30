<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class LoginController extends Controller
{
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
            throw ValidationException::withMessages([
                'email' => ['メールアドレスまたはパスワードが正しくありません'],
            ]);
        }

        // アカウント状態チェック
        if ($user->status !== 'approved') {
            throw ValidationException::withMessages([
                'email' => ['このアカウントは現在ログインできません（ステータス: ' . $user->status . '）'],
            ]);
        }

        if (!$user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['このアカウントは無効化されています'],
            ]);
        }

        // 2FA が有効な場合はコード入力を要求
        if ($user->two_factor_confirmed_at) {
            return response()->json([
                'success' => true,
                'data' => [
                    'two_factor_required' => true,
                    'user_id' => $user->id,
                ],
            ]);
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
