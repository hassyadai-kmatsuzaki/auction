<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        // ----------------------------------------------------------------
        // Cypress E2E 用テストヘルパー (routes/api-test.php) のロード
        // ----------------------------------------------------------------
        // APP_ENV が local / testing / staging の場合だけ /api/test-helpers/* を有効化する。
        // 本番では then クロージャ内の if が false になるため、ルートファイル自体が
        // include されない (＝多重防御の (A))。
        // さらに routes/api-test.php 側でも EnsureNonProduction ミドルウェアを噛ませて
        // 404 にする (＝多重防御の (B))。
        //
        // ※ 本番デプロイ時は必ず APP_ENV=production になっていることを確認すること。
        then: function () {
            if (app()->environment(['local', 'testing', 'staging'])) {
                Route::middleware('api')
                    ->prefix('api')
                    ->group(__DIR__.'/../routes/api-test.php');
            }
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'check.role' => \App\Http\Middleware\CheckRole::class,
            'rate.limit' => \App\Http\Middleware\RateLimitByIp::class,
            'audit' => \App\Http\Middleware\AuditLog::class,
            'check.subscription' => \App\Http\Middleware\CheckSubscription::class,
            'ensure.auction.editable' => \App\Http\Middleware\EnsureAuctionEditable::class,
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
            // SES → SNS Webhook は AWS から POST されるため CSRF 適用外。
            // 認証は SNS 署名検証 + Topic ARN ホワイトリストで行う。
            'webhooks/ses/*',
        ]);
    })
    ->withSchedule(function (Schedule $schedule): void {
        // 公開予約されたお知らせを1分ごとに自動公開
        $schedule->command('announcements:publish-scheduled')->everyMinute();

        // 予定されたオークションを1分ごとに自動開始
        $schedule->command('auctions:start-scheduled')->everyMinute();

        // 開始30分前のオークションに開始予告通知を送信（参加者・出品者）
        // 開始時刻と同時の大量メール送信を避けてキュー/Redisへの瞬間負荷を分散する目的。
        // ProcessAuctionCountdownJob 側に start_notice_sent_at IS NULL のときだけ
        // 開始時に送るフォールバックを持たせており、scheduler 落ち時も保険が効く。
        $schedule->command('auctions:dispatch-start-notice')->everyMinute()
            ->withoutOverlapping();

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

        // 年会費サブスクの自動更新（毎日 3:00 に期限切れを再課金）
        $schedule->command('subscriptions:renew')->dailyAt('03:00')
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
