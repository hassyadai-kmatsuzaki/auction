<?php

namespace App\Providers;

use App\Repositories\Contracts\AuctionRepositoryInterface;
use App\Repositories\Contracts\BidParticipantRepositoryInterface;
use App\Repositories\Contracts\ItemRepositoryInterface;
use App\Repositories\Contracts\LaneRepositoryInterface;
use App\Repositories\Eloquent\AuctionRepository;
use App\Repositories\Eloquent\BidParticipantRepository;
use App\Repositories\Eloquent\ItemRepository;
use App\Repositories\Eloquent\LaneRepository;
use App\Actions\Bid\FinalizeBidAction;
use App\Actions\Bid\LeaveBidAction;
use App\Actions\Bid\SetBidLimitAction;
use App\Actions\Line\NotifyFavoriteApproachingAction;
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
        // ========== Repository バインド ==========
        $this->app->bind(BidParticipantRepositoryInterface::class, BidParticipantRepository::class);
        $this->app->bind(AuctionRepositoryInterface::class,        AuctionRepository::class);
        $this->app->bind(ItemRepositoryInterface::class,           ItemRepository::class);
        $this->app->bind(LaneRepositoryInterface::class,           LaneRepository::class);

        // ========== Service シングルトン ==========
        // BidService: 後方互換のためシングルトンを維持
        $this->app->singleton(BidService::class, function ($app) {
            return new BidService();
        });

        $this->app->singleton(CountdownService::class, function ($app) {
            return new CountdownService(
                $app->make(FinalizeBidAction::class),
                $app->make(LeaveBidAction::class),
                $app->make(SetBidLimitAction::class),
                $app->make(NotifyFavoriteApproachingAction::class),
            );
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
