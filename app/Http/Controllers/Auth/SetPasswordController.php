<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\EmailVerificationToken;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class SetPasswordController extends Controller
{
    /**
     * トークンの有効性を検証
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function verify(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
        ]);

        $verificationToken = EmailVerificationToken::where('token', $request->token)
            ->where('expires_at', '>', now())
            ->whereNull('verified_at')
            ->with('user')
            ->first();

        if (!$verificationToken) {
            return response()->json([
                'success' => false,
                'message' => 'トークンが無効または期限切れです',
            ], 400);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'name' => $verificationToken->user->name,
                    'email' => $verificationToken->user->email,
                ],
            ],
        ]);
    }

    /**
     * パスワードを設定
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function setPassword(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $verificationToken = EmailVerificationToken::where('token', $request->token)
            ->where('expires_at', '>', now())
            ->whereNull('verified_at')
            ->with('user')
            ->first();

        if (!$verificationToken) {
            return response()->json([
                'success' => false,
                'message' => 'トークンが無効または期限切れです',
            ], 400);
        }

        DB::beginTransaction();
        try {
            $user = $verificationToken->user;

            // パスワードを設定
            $user->update([
                'password' => Hash::make($request->password),
                'email_verified_at' => now(),
            ]);

            // トークンを検証済みにする
            $verificationToken->update([
                'verified_at' => now(),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'パスワードを設定しました。ログインしてください。',
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
