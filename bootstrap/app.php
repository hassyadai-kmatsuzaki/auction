<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;

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
        ]);
        
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
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
