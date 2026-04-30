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
use App\Services\Monitoring\MetricRecorder;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
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
                $app->make(MetricRecorder::class),
            );
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();
    }

    /**
     * ライブオークション系 API のレート制限。
     *
     * 入札・指値・お気に入りなど書込み系を中心に、
     * 認証済みユーザー単位で抑制し、未認証は IP 単位で制限する。
     * 通常操作（連打を含む）は許容しつつ、ボット級の高頻度を遮断するのが目的。
     */
    protected function configureRateLimiting(): void
    {
        $byUserOrIp = fn (Request $r) => $r->user()?->id ?? $r->ip();

        // 入札 ON/OFF: 同一ユーザーは 1 秒に 4 回まで
        // bid_inflight ロック衝突時のリトライを織り込んでも十分な余裕を持たせる
        RateLimiter::for('bids', fn (Request $r) =>
            Limit::perSecond(4)->by($byUserOrIp($r))
        );

        // 指値の作成・削除: 1 秒に 2 回（通常は人間操作で十分）
        RateLimiter::for('bid-limits', fn (Request $r) =>
            Limit::perSecond(2)->by($byUserOrIp($r))
        );

        // お気に入りトグル: 1 分に 60 回
        RateLimiter::for('favorites', fn (Request $r) =>
            Limit::perMinute(60)->by($byUserOrIp($r))
        );

        // 参加者向け一般 API（読み取り中心）: 1 分に 300 回
        RateLimiter::for('participant-general', fn (Request $r) =>
            Limit::perMinute(300)->by($byUserOrIp($r))
        );
    }
}
