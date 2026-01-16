<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Mail\PasswordResetMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;

class PasswordResetController extends Controller
{
    /**
     * パスワードリセット申請
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function forgot(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            // セキュリティ上、ユーザーが存在しなくても成功レスポンスを返す
            return response()->json([
                'success' => true,
                'message' => 'パスワードリセット用のメールを送信しました',
            ]);
        }

        // トークン生成
        $token = Password::createToken($user);

        // メール送信
        $resetUrl = config('app.frontend_url') . '/auth/reset-password?token=' . $token . '&email=' . urlencode($user->email);
        Mail::to($user->email)->send(new PasswordResetMail($user, $resetUrl));

        return response()->json([
            'success' => true,
            'message' => 'パスワードリセット用のメールを送信しました',
        ]);
    }

    /**
     * パスワードリセット実行
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function reset(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user, $password) {
                $user->forceFill([
                    'password' => Hash::make($password)
                ])->save();
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json([
                'success' => true,
                'message' => 'パスワードをリセットしました',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'パスワードリセットに失敗しました',
        ], 400);
    }
}
