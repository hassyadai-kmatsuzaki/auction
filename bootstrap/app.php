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
        //
    })->create();
