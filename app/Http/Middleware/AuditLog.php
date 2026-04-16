<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class AuditLog
{
    /**
     * 重要な操作を監査ログに記録
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // 書き込み系のリクエストのみ記録
        if (!in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'])) {
            return $response;
        }

        $user = $request->user();

        $logData = [
            'timestamp' => now()->toIso8601String(),
            'user_id' => $user?->id,
            'user_email' => $user?->email,
            'method' => $request->method(),
            'path' => $request->path(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'status_code' => $response->getStatusCode(),
        ];

        // パスワードなど機密情報を除外
        $params = $request->except(['password', 'password_confirmation', 'two_factor_secret', 'code']);
        if (!empty($params)) {
            $logData['params'] = $params;
        }

        Log::channel('audit')->info('API_ACTION', $logData);

        return $response;
    }
}
