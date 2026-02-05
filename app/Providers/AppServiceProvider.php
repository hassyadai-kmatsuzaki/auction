<?php

namespace App\Providers;

use App\Services\BidService;
use App\Services\CountdownService;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // BidServiceをシングルトンで登録
        $this->app->singleton(BidService::class, function ($app) {
            return new BidService();
        });

        // CountdownServiceをシングルトンで登録
        $this->app->singleton(CountdownService::class, function ($app) {
            $countdownService = new CountdownService($app->make(BidService::class));
            // BidServiceにCountdownServiceを設定（循環参照解決）
            $app->make(BidService::class)->setCountdownService($countdownService);
            return $countdownService;
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
