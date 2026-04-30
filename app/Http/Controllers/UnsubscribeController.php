<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

/**
 * 配信停止リンクのハンドラ。
 *
 * 各メールフッターから `/unsubscribe/{token}` でアクセスされる。
 * トークンは User モデル作成時に発行される 48 文字のランダム文字列。
 *
 * GET でも POST でも opt-out できるようにしておく（メールクライアントの自動プリフェッチ
 * で勝手に opt-out されるリスクはあるが、ワンクリック停止の方が苦情率を下げる効果が大きい）。
 */
class UnsubscribeController extends Controller
{
    public function show(string $token)
    {
        $user = User::where('unsubscribe_token', $token)->first();

        if (!$user) {
            return response()->view('unsubscribe.invalid', [], 404);
        }

        if ($user->email_opt_out_at === null) {
            $user->email_opt_out_at = now();
            $user->save();
        }

        return response()->view('unsubscribe.done', [
            'email' => $user->email,
        ]);
    }
}
