<?php

namespace App\Http\Controllers\Auth\Concerns;

use App\Mail\OtherDeviceLoggedInMail;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

/**
 * 同一ユーザーの多重ログインを「他端末ログアウト確認モーダル経由」で1セッションに絞るための共通処理。
 *
 * - LoginController.login と TwoFactorController.verify が共有する。
 * - SPA は 409 ALREADY_LOGGED_IN を受けたら確認モーダルを出し、force_logout_others=true で再送する。
 */
trait EnforcesSingleSession
{
    /**
     * 直近で使われている auth-token があるか。30分の鮮度判定で「ゴーストトークン」を回避する。
     *
     * 注意: last_used_at は最新リクエストで更新されるが、未使用のまま発行直後のトークンも
     *       存在し得るので created_at もOR条件に入れる。
     */
    protected function hasActiveAuthToken(User $user): bool
    {
        $threshold = now()->subMinutes(30);

        return $user->tokens()
            ->where('name', 'auth-token')
            ->where(function ($q) use ($threshold) {
                $q->where('last_used_at', '>=', $threshold)
                  ->orWhere('created_at', '>=', $threshold);
            })
            ->exists();
    }

    /**
     * 旧トークンを全削除し、削除が発生していたら他端末ログイン通知メールを送る。
     * メール送信は priority キューに乗るので Mailable 側に責務を委譲する。
     */
    protected function revokeOtherSessionsAndNotify(User $user, Request $request): void
    {
        $deleted = $user->tokens()->where('name', 'auth-token')->delete();

        if ($deleted <= 0) {
            return;
        }

        Mail::to($user->email)->queue(new OtherDeviceLoggedInMail(
            user: $user,
            loginIp: (string) $request->ip(),
            loginUserAgent: (string) ($request->userAgent() ?? ''),
            loginAt: now()->toDateTimeString(),
        ));
    }

    /**
     * 既存セッションが居る場合の 409 レスポンス。SPA はこの code を見て確認モーダルを出す。
     */
    protected function alreadyLoggedInResponse(int $userId)
    {
        return response()->json([
            'success' => false,
            'code'    => 'ALREADY_LOGGED_IN',
            'message' => '他の端末で現在ログイン中です。そちらをログアウトするか、強制的にログアウトして続行してください。',
            'data'    => ['user_id' => $userId],
        ], 409);
    }
}
