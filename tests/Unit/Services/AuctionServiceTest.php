<?php

namespace Tests\Unit\Services;

use App\Models\Auction;
use App\Models\SystemSetting;
use App\Models\User;
use App\Services\AuctionService;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * AuctionService の Unit テスト。
 *
 * - 待機室の手動オープン / クローズ / 状態判定
 * - 開始カウントダウンの残時間計算
 * - 同意画面表示設定
 */
class AuctionServiceTest extends TestCase
{
    private AuctionService $service;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Cache::flush();
        $this->service = new AuctionService();
        $this->admin = $this->createAdmin();
    }

    public function test_openEntranceManually_は_キャッシュにフラグを書く(): void
    {
        $this->service->openEntranceManually(1);
        $this->assertTrue($this->service->isEntranceManuallyOpened(1));
    }

    public function test_closeEntranceManually_は_キャッシュを消す(): void
    {
        $this->service->openEntranceManually(2);
        $this->service->closeEntranceManually(2);
        $this->assertFalse($this->service->isEntranceManuallyOpened(2));
    }

    public function test_isEntranceManuallyOpened_デフォルトはfalse(): void
    {
        $this->assertFalse($this->service->isEntranceManuallyOpened(99999));
    }

    public function test_resolveEntranceState_は_scheduled以外でentrance_checkがfalse(): void
    {
        $auction = Auction::factory()->live()->create(['created_by' => $this->admin->id]);
        $state = $this->service->resolveEntranceState($auction);
        $this->assertFalse($state['entrance_check']);
    }

    public function test_resolveEntranceState_は_時間外で入室不可(): void
    {
        // event_date を翌週に設定 → 入室時刻のかなり前 → 入室不可
        $auction = Auction::factory()->scheduled()->create([
            'created_by' => $this->admin->id,
            'event_date' => now()->addDays(7),
            'start_time' => '20:00',
        ]);

        $state = $this->service->resolveEntranceState($auction);
        $this->assertTrue($state['entrance_check']);
        $this->assertFalse($state['entrance_allowed']);
        $this->assertArrayHasKey('message', $state);
        $this->assertArrayHasKey('entrance_at', $state);
    }

    public function test_resolveEntranceState_は_手動公開で時間外でも入室可能(): void
    {
        $auction = Auction::factory()->scheduled()->create([
            'created_by' => $this->admin->id,
            'event_date' => now()->addDays(7),
            'start_time' => '20:00',
        ]);
        $this->service->openEntranceManually($auction->id);

        $state = $this->service->resolveEntranceState($auction);
        $this->assertTrue($state['entrance_check']);
        $this->assertTrue($state['entrance_allowed']);
        $this->assertTrue($state['manually_opened']);
    }

    public function test_resolveEntranceState_は_開催時間直前なら入室可能(): void
    {
        $auction = Auction::factory()->scheduled()->create([
            'created_by' => $this->admin->id,
            'event_date' => now()->toDateString(),
            'start_time' => now()->addMinutes(5)->format('H:i'),
        ]);

        $state = $this->service->resolveEntranceState($auction);
        $this->assertTrue($state['entrance_allowed']);
        $this->assertFalse($state['manually_opened']);
    }

    public function test_resolveEntranceState_は_開催時刻を大幅超過で入室終了表示(): void
    {
        $auction = Auction::factory()->scheduled()->create([
            'created_by' => $this->admin->id,
            'event_date' => now()->subDay()->toDateString(),
            'start_time' => '10:00',
        ]);

        $state = $this->service->resolveEntranceState($auction);
        $this->assertFalse($state['entrance_allowed']);
        $this->assertStringContainsString('終了', $state['message']);
    }

    public function test_getStartingCountdown_は_キャッシュなしならnull(): void
    {
        $this->assertNull($this->service->getStartingCountdown(99999));
    }

    public function test_getStartingCountdown_は_未来時刻で残秒数を返す(): void
    {
        Cache::put('auction:5:start_at', now()->addSeconds(30)->timestamp, 120);
        $remaining = $this->service->getStartingCountdown(5);
        $this->assertNotNull($remaining);
        $this->assertGreaterThan(20, $remaining);
        $this->assertLessThanOrEqual(30, $remaining);
    }

    public function test_getStartingCountdown_は_過去時刻でnull(): void
    {
        Cache::put('auction:6:start_at', now()->subSeconds(10)->timestamp, 120);
        $this->assertNull($this->service->getStartingCountdown(6));
    }

    public function test_shouldShowConsentScreen_は_設定値を返す(): void
    {
        $this->assertFalse($this->service->shouldShowConsentScreen());

        SystemSetting::set('show_consent_screen', true);
        $this->assertTrue($this->service->shouldShowConsentScreen());

        SystemSetting::set('show_consent_screen', false);
        $this->assertFalse($this->service->shouldShowConsentScreen());
    }
}
