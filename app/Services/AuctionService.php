<?php

namespace App\Services;

use App\Models\Auction;
use App\Models\SystemSetting;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

class AuctionService
{
    /**
     * 待機室・ライブ状態を判定して構造化データを返す
     *
     * Participant/AuctionController::live() から抽出
     *
     * @return array{status: string, entrance_allowed?: bool, ...}
     */
    public function resolveEntranceState(Auction $auction): array
    {
        if ($auction->status !== 'scheduled') {
            return ['entrance_check' => false]; // live / finished / others
        }

        $settings           = $auction->getAuctionSettings();
        $venueOpenMinutes   = $settings['venue_open_minutes_before_start'] ?? 30;
        $startDateTime      = Carbon::parse(
            $auction->event_date->format('Y-m-d') . ' ' . $auction->start_time
        );
        $entranceAt = $startDateTime->copy()->subMinutes($venueOpenMinutes);
        $now        = now();

        if ($now->lt($entranceAt)) {
            return [
                'entrance_check'                   => true,
                'entrance_allowed'                  => false,
                'entrance_at'                       => $entranceAt->toIso8601String(),
                'start_at'                          => $startDateTime->toIso8601String(),
                'venue_open_minutes_before_start'   => $venueOpenMinutes,
                'message'                           => "オークション開始{$venueOpenMinutes}分前から入室できます",
            ];
        }

        return [
            'entrance_check'  => true,
            'entrance_allowed'=> true,
            'start_at'        => $startDateTime->toIso8601String(),
        ];
    }

    /**
     * 開始カウントダウン中かどうかを確認し、残り秒数を返す
     *
     * @return int|null null = カウントダウン中でない
     */
    public function getStartingCountdown(int $auctionId): ?int
    {
        $startAt = Cache::get("auction:{$auctionId}:start_at");
        if (!$startAt) {
            return null;
        }

        $remaining = max(0, $startAt - now()->timestamp);
        return $remaining > 0 ? $remaining : null;
    }

    /**
     * 同意画面の表示設定を取得
     */
    public function shouldShowConsentScreen(): bool
    {
        return (bool) SystemSetting::get('show_consent_screen', false);
    }
}
