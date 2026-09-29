<?php

namespace App\Console\Commands;

use App\Services\GmoAozora\GmoAozoraApiException;
use App\Services\GmoAozora\GmoAozoraOAuthService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * GMOあおぞら アクセストークンの定期リフレッシュ。
 *
 * 失効すると入金明細通知（Webhook）が止まり、失効中の明細は再送されない（仕様書 イベント通知編 制限事項）。
 * スケジューラで毎日実行し、失効 refresh_before_days 日前を切っていれば更新する。--force で無条件更新。
 */
class GmoAozoraRefreshTokenCommand extends Command
{
    protected $signature = 'gmo-aozora:refresh-token {--force : 期限に関わらずリフレッシュする}';
    protected $description = 'GMOあおぞら アクセストークンを失効前にリフレッシュする';

    public function handle(GmoAozoraOAuthService $oauth): int
    {
        $token = $oauth->token();
        if (!$token) {
            $this->line('トークン未取得（認可前）。何もしません。');
            return self::SUCCESS;
        }

        $days = (int) config('services.gmo_aozora.refresh_before_days', 7);
        if (!$this->option('force') && !$token->isExpired() && !$token->expiresWithin($days)) {
            $this->line(sprintf('失効まで %s 日あるためスキップ（expires_at=%s）',
                $token->expires_at ? (int) now()->diffInDays($token->expires_at, false) : '?',
                $token->expires_at?->toDateTimeString()));
            return self::SUCCESS;
        }

        try {
            $token = $oauth->refresh($token);
        } catch (GmoAozoraApiException $e) {
            $this->error('リフレッシュ失敗: ' . $e->getMessage());
            Log::error('GMO Aozora token refresh failed (scheduled)', $e->toArray());
            return self::FAILURE;
        }

        $this->info('リフレッシュ完了。expires_at=' . $token->expires_at?->toDateTimeString());
        return self::SUCCESS;
    }
}
