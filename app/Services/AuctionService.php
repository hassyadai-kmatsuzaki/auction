<?php

namespace App\Services;

use App\Models\Auction;
use App\Models\SystemSetting;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

class AuctionService
{
    /** 手動公開フラグのキャッシュキー */
    private function entranceOverrideKey(int $auctionId): string
    {
        return "auction:{$auctionId}:entrance_override";
    }

    /**
     * 管理者が手動で待機室を公開する
     */
    public function openEntranceManually(int $auctionId): void
    {
        // オークション開始後もキャッシュが残らないよう TTL = 24時間
        Cache::put($this->entranceOverrideKey($auctionId), true, now()->addHours(24));
    }

    /**
     * 管理者が手動で待機室を閉鎖する（時間制御に戻す）
     */
    public function closeEntranceManually(int $auctionId): void
    {
        Cache::forget($this->entranceOverrideKey($auctionId));
    }

    /**
     * 手動公開フラグが立っているか確認
     */
    public function isEntranceManuallyOpened(int $auctionId): bool
    {
        return (bool) Cache::get($this->entranceOverrideKey($auctionId), false);
    }

    /**
     * 待機室・ライブ状態を判定して構造化データを返す
     *
     * 手動公開フラグが立っている場合は時間に関わらず入室を許可する。
     *
     * @return array{status: string, entrance_allowed?: bool, ...}
     */
    public function resolveEntranceState(Auction $auction): array
    {
        if ($auction->status !== 'scheduled') {
            return ['entrance_check' => false]; // live / finished / others
        }

        $settings         = $auction->getAuctionSettings();
        $venueOpenMinutes = $settings['venue_open_minutes_before_start'] ?? 30;
        $startDateTime    = Carbon::parse(
            $auction->event_date->format('Y-m-d') . ' ' . $auction->start_time
        );
        $entranceAt = $startDateTime->copy()->subMinutes($venueOpenMinutes);
        $now        = now();

        // 手動公開オーバーライドが有効、または自然に入室可能時刻を過ぎた場合
        $manuallyOpened = $this->isEntranceManuallyOpened($auction->id);

        if (!$manuallyOpened && $now->lt($entranceAt)) {
            return [
                'entrance_check'                  => true,
                'entrance_allowed'                 => false,
                'entrance_at'                      => $entranceAt->toIso8601String(),
                'start_at'                         => $startDateTime->toIso8601String(),
                'venue_open_minutes_before_start'  => $venueOpenMinutes,
                'message'                          => "オークション開始{$venueOpenMinutes}分前から入室できます",
                'manually_opened'                  => false,
            ];
        }

        return [
            'entrance_check'   => true,
            'entrance_allowed' => true,
            'start_at'         => $startDateTime->toIso8601String(),
            'manually_opened'  => $manuallyOpened,
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
