<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * プランの allows_bid / allows_sell によって機能を制限する
 *
 * 使い方:
 *   Route::middleware('check.subscription:bid')->...  // 入札・落札系
 *   Route::middleware('check.subscription:sell')->... // 出品系
 *   Route::middleware('check.subscription')->...      // いずれかのactiveサブスクが必要
 *
 * admin ロールは常にスルーする（管理操作を止めないため）。
 */
class CheckSubscription
{
    public function handle(Request $request, Closure $next, string $capability = 'any'): Response
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => '認証が必要です',
            ], 401);
        }

        // 管理者は常に許可
        if ($user->hasRole('admin')) {
            return $next($request);
        }

        // id <= 509 はテストユーザーのためサブスクリプション必須チェックを免除
        if ($user->id <= 509) {
            return $next($request);
        }

        $subscription = $user->subscription()->with('plan')->first();

        if (!$subscription || !$subscription->isActive()) {
            return response()->json([
                'success' => false,
                'message' => '有効な年会費プランへの加入が必要です',
                'code'    => 'SUBSCRIPTION_REQUIRED',
            ], 402); // 402 Payment Required
        }

        $plan = $subscription->plan;
        if (!$plan) {
            return response()->json([
                'success' => false,
                'message' => 'プラン情報が見つかりません',
                'code'    => 'PLAN_NOT_FOUND',
            ], 402);
        }

        $ok = match ($capability) {
            'bid'   => (bool) $plan->allows_bid,
            'sell'  => (bool) $plan->allows_sell,
            default => true,
        };

        if (!$ok) {
            $message = $capability === 'bid'
                ? 'ご加入のプランでは落札機能をご利用いただけません'
                : ($capability === 'sell'
                    ? 'ご加入のプランでは出品機能をご利用いただけません'
                    : 'この機能は利用できません');

            return response()->json([
                'success' => false,
                'message' => $message,
                'code'    => 'PLAN_CAPABILITY_MISSING',
                'required_capability' => $capability,
            ], 403);
        }

        return $next($request);
    }
}
