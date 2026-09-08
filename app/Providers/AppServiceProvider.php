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
use App\Services\BidService;
use App\Services\CountdownService;
use App\Services\Monitoring\MetricRecorder;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use App\Support\Aws\LaravelCacheAdapter;

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
        $this->configureOutgoingMailHeaders();
        $this->configureAwsCredentialCache();
    }

    /**
     * A-13 (2026-09-08): IAM Role 運用時の AWS 認証情報をホスト内で共有キャッシュする。
     *
     * アクセスキーが .env に無い（= IAM Role で解決する）場合だけ、S3 ディスクの credentials に
     * 「Laravel cache に載せたプロバイダ」を差し込む。php-fpm のプロセスごとに IMDS へ取りに行かず、
     * 一斉アクセス時の 401 → 画像 API 500 を無くす。
     *
     * config:cache の実行中は差し込まない（クロージャは設定キャッシュに書き出せない）。
     * 無効化したいときは .env に AWS_CREDENTIAL_CACHE=false（config/filesystems.php 経由なので config:cache 後も効く）。
     */
    protected function configureAwsCredentialCache(): void
    {
        if (!config('filesystems.aws_credential_cache', true)) {
            return;
        }
        if ($this->app->runningInConsole() && $this->app->runningConsoleCommand('config:cache', 'config:clear')) {
            return;
        }

        $s3 = config('filesystems.disks.s3', []);
        if (empty($s3['bucket']) || !empty($s3['key']) || !empty($s3['credentials'])) {
            return;
        }
        if (!class_exists(\Aws\Credentials\CredentialProvider::class)) {
            return;
        }

        $provider = \Aws\Credentials\CredentialProvider::cache(
            \Aws\Credentials\CredentialProvider::defaultProvider(),
            new LaravelCacheAdapter(),
            'credentials:' . (string) config('app.env', 'production')
        );

        config(['filesystems.disks.s3.credentials' => $provider]);
    }

    /**
     * 全送信メールに共通ヘッダを差し込む。
     *
     * - Reply-To: 返信不可運用なので noreply に固定
     * - Auto-Submitted / X-Auto-Response-Suppress: 自動応答ループ抑止
     * - X-SES-CONFIGURATION-SET: SES のバウンス/苦情イベントを SNS に流すために必須
     *
     * Mailable 側に手を入れないことで、既存・新規いずれのメールにも一律適用する。
     */
    protected function configureOutgoingMailHeaders(): void
    {
        $configurationSet = config('services.ses.configuration_set');
        $replyTo = config('mail.reply_to.address') ?: config('mail.from.address');

        Event::listen(function (MessageSending $event) use ($configurationSet, $replyTo) {
            $message = $event->message; // Symfony\Component\Mime\Email
            $headers = $message->getHeaders();

            if ($replyTo && !$headers->has('Reply-To')) {
                $message->replyTo($replyTo);
            }
            if (!$headers->has('Auto-Submitted')) {
                $headers->addTextHeader('Auto-Submitted', 'auto-generated');
            }
            if (!$headers->has('X-Auto-Response-Suppress')) {
                $headers->addTextHeader('X-Auto-Response-Suppress', 'All');
            }
            if ($configurationSet && !$headers->has('X-SES-CONFIGURATION-SET')) {
                $headers->addTextHeader('X-SES-CONFIGURATION-SET', $configurationSet);
            }
        });
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

        // SES 送信レート制限。SES アカウントの Max send rate (TPS) に合わせて設定する。
        // notify キューワーカーが複数プロセスで動いていても、グローバルにこの上限を超えない。
        // 上限超過時は SendCampaignEmailJob が release() されてリトライされる。
        RateLimiter::for('ses-send', fn () =>
            Limit::perSecond((int) config('services.ses.send_rate_per_second', 14))->by('ses-global')
        );
    }
}
