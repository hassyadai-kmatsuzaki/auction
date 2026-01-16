<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => '認証が必要です',
            ], 401);
        }

        $userRoles = $user->roles()->pluck('name')->toArray();

        // 指定されたロールのいずれかを持っているかチェック
        $hasRole = !empty(array_intersect($roles, $userRoles));

        if (!$hasRole) {
            return response()->json([
                'success' => false,
                'message' => 'この機能にアクセスする権限がありません',
            ], 403);
        }

        return $next($request);
    }
}
