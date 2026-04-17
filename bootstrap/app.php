<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'check.role' => \App\Http\Middleware\CheckRole::class,
            'rate.limit' => \App\Http\Middleware\RateLimitByIp::class,
            'audit' => \App\Http\Middleware\AuditLog::class,
        ]);

        // ALB（HTTPS終端）配下での X-Forwarded-* を信頼
        $middleware->trustProxies(at: '*', headers:
            Request::HEADER_X_FORWARDED_FOR |
            Request::HEADER_X_FORWARDED_HOST |
            Request::HEADER_X_FORWARDED_PORT |
            Request::HEADER_X_FORWARDED_PROTO |
            Request::HEADER_X_FORWARDED_AWS_ELB
        );

        // APIではCSRF保護を無効化
        $middleware->validateCsrfTokens(except: [
            'api/*',
        ]);
    })
    ->withSchedule(function (Schedule $schedule): void {
        // 公開予約されたお知らせを1分ごとに自動公開
        $schedule->command('announcements:publish-scheduled')->everyMinute();

        // 予定されたオークションを1分ごとに自動開始
        $schedule->command('auctions:start-scheduled')->everyMinute();

        // ライブオークションのカウントダウンジョブ監視・自動復旧
        $schedule->command('auctions:monitor-jobs')->everyMinute();

        // 入金催促通知（30分ごとに未入金チェック）
        $schedule->job(new \App\Jobs\SendPaymentReminderJob)->everyThirtyMinutes()
            ->withoutOverlapping();

        // オークション前日予告通知（毎日18:00に翌日分をチェック）
        $schedule->job(new \App\Jobs\SendAuctionPreviewJob)->dailyAt('18:00')
            ->withoutOverlapping();

        // 週次レポート自動生成（毎週月曜 9:00）
        $schedule->command('reports:generate weekly')->weeklyOn(1, '09:00')
            ->withoutOverlapping();

        // 月次レポート自動生成（毎月1日 9:00）
        $schedule->command('reports:generate monthly')->monthlyOn(1, '09:00')
            ->withoutOverlapping();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Throwable $e, Request $request) {
            if (! $request->expectsJson() && ! $request->is('api/*')) {
                return null;
            }

            if ($e instanceof \Illuminate\Validation\ValidationException) {
                return response()->json([
                    'success' => false,
                    'message' => '入力内容に誤りがあります。ご確認ください。',
                    'errors'  => $e->errors(),
                ], 422);
            }

            if ($e instanceof \Illuminate\Auth\AuthenticationException) {
                return response()->json([
                    'success' => false,
                    'message' => 'ログインが必要です。再度ログインしてください。',
                ], 401);
            }

            if ($e instanceof \Illuminate\Auth\Access\AuthorizationException
                || $e instanceof \Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException) {
                return response()->json([
                    'success' => false,
                    'message' => 'この操作を行う権限がありません。',
                ], 403);
            }

            if ($e instanceof \Illuminate\Database\Eloquent\ModelNotFoundException
                || $e instanceof \Symfony\Component\HttpKernel\Exception\NotFoundHttpException) {
                return response()->json([
                    'success' => false,
                    'message' => '対象のデータが見つかりませんでした。',
                ], 404);
            }

            if ($e instanceof \Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException) {
                return response()->json([
                    'success' => false,
                    'message' => '許可されていない操作です。',
                ], 405);
            }

            if ($e instanceof \Illuminate\Http\Exceptions\PostTooLargeException) {
                return response()->json([
                    'success' => false,
                    'message' => 'ファイルサイズが大きすぎます。上限を超えない画像・動画を選択してください。',
                ], 413);
            }

            if ($e instanceof \Illuminate\Http\Exceptions\ThrottleRequestsException) {
                return response()->json([
                    'success' => false,
                    'message' => 'リクエストが多すぎます。しばらく待ってから再度お試しください。',
                ], 429);
            }

            if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) {
                $status = $e->getStatusCode();
                $map = [
                    400 => 'リクエストに問題があります。内容をご確認ください。',
                    408 => 'タイムアウトしました。通信状況をご確認のうえ再度お試しください。',
                    409 => '競合が発生しました。画面を更新してから再度お試しください。',
                    413 => 'ファイルサイズが大きすぎます。上限を超えない画像・動画を選択してください。',
                    419 => 'セッションが切れました。再度ログインしてください。',
                    422 => '入力内容に誤りがあります。ご確認ください。',
                    429 => 'リクエストが多すぎます。しばらく待ってから再度お試しください。',
                    500 => 'サーバーエラーが発生しました。時間をおいて再度お試しください。',
                    502 => 'サーバーに接続できませんでした。時間をおいて再度お試しください。',
                    503 => 'ただいまメンテナンス中、または混雑しています。時間をおいて再度お試しください。',
                    504 => 'サーバーの応答がありません。時間をおいて再度お試しください。',
                ];
                return response()->json([
                    'success' => false,
                    'message' => $map[$status] ?? 'エラーが発生しました。時間をおいて再度お試しください。',
                ], $status);
            }

            return response()->json([
                'success' => false,
                'message' => 'サーバーエラーが発生しました。時間をおいて再度お試しください。',
            ], 500);
        });
    })->create();
