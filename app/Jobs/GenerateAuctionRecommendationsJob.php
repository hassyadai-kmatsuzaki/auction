<?php

namespace App\Jobs;

use App\Models\Auction;
use App\Models\User;
use App\Services\AI\AiDataScope;
use App\Services\AI\RecommendationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * オークション公開時に、参加者ごとの「おすすめ」を作っておく（F-057）。
 * 表示はしない（作成のみ）。ライブ中の開催があれば負荷を避けて1時間後にやり直す。
 * 1人の失敗で残りを止めない
 */
class GenerateAuctionRecommendationsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 1800;

    /** 直近この日数以内にログインした会員だけを対象にする */
    private const ACTIVE_DAYS = 180;

    public function __construct(public int $auctionId)
    {
        $this->onQueue('default');
    }

    public function handle(RecommendationService $service): void
    {
        if (!config('features.recommendations')) {
            return;
        }
        if (Auction::where('status', 'live')->exists()) {
            self::dispatch($this->auctionId)->delay(now()->addHour());
            return;
        }

        $auction = Auction::find($this->auctionId);
        if (!$auction) {
            return;
        }

        $houseBuyers = AiDataScope::houseBuyerIds();
        $generated = 0;
        $failed = 0;

        User::query()
            ->where('status', 'approved')
            ->where('is_active', true)
            ->where('last_login_at', '>=', now()->subDays(self::ACTIVE_DAYS))
            ->whereHas('roles', fn ($q) => $q->where('name', 'participant'))
            // テスト開催はテストユーザーだけ、本番開催はテストユーザー以外
            ->where(fn ($q) => $auction->is_test
                ? $q->where('is_test', true)
                : $q->where('is_test', false)->orWhereNull('is_test'))
            ->whereNotIn('id', $houseBuyers)
            ->orderBy('id')
            ->chunkById(100, function ($users) use ($service, &$generated, &$failed) {
                foreach ($users as $user) {
                    try {
                        $service->generateRecommendations($user);
                        $generated++;
                    } catch (\Throwable $e) {
                        $failed++;
                        Log::warning('Recommendation generation failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
                    }
                }
            });

        Log::info('Auction recommendations generated', ['auction_id' => $this->auctionId, 'users' => $generated, 'failed' => $failed]);
    }
}
