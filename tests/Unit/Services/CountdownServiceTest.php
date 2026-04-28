<?php

namespace Tests\Unit\Services;

use App\Models\Auction;
use App\Models\BidParticipant;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Models\User;
use App\Services\CountdownService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * CountdownService の Unit テスト。
 *
 * イベント broadcast / Cache 操作 / Lane の状態遷移を検証する。
 * 0.5秒tick の自動進行は本番でジョブ駆動なので、単発呼び出しでの状態変化を確認する。
 */
class CountdownServiceTest extends TestCase
{
    private User $admin;
    private SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Cache::flush();
        Event::fake();
        $this->admin = $this->createAdmin();
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
    }

    private function makeLiveLane(int $price = 10000): Lane
    {
        $auction = Auction::factory()->live()->create(['created_by' => $this->admin->id]);
        $lane = Lane::factory()->active()->create(['auction_id' => $auction->id]);
        $item = Item::factory()->live()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'current_price' => $price,
        ]);
        $lane->update(['current_item_id' => $item->id]);
        return $lane->fresh(['currentItem', 'auction']);
    }

    public function test_startCountdown_は_キャッシュにbidding状態を書く(): void
    {
        $lane = $this->makeLiveLane();
        app(CountdownService::class)->startCountdown($lane);

        $state = Cache::get("countdown:lane:{$lane->id}");
        $this->assertNotNull($state);
        $this->assertSame('bidding', $state['phase']);
        $this->assertTrue($state['is_running']);
        $this->assertGreaterThan(0, $state['remaining_seconds']);
        $this->assertSame($lane->id, $state['lane_id']);
    }

    public function test_startCountdown_は_currentItemがなければ何もしない(): void
    {
        $auction = Auction::factory()->live()->create(['created_by' => $this->admin->id]);
        $lane = Lane::factory()->create(['auction_id' => $auction->id, 'current_item_id' => null]);

        app(CountdownService::class)->startCountdown($lane);
        $this->assertNull(Cache::get("countdown:lane:{$lane->id}"));
    }

    public function test_startPreBidCountdown_は_pre_bidフェーズ_にする(): void
    {
        $lane = $this->makeLiveLane();
        app(CountdownService::class)->startPreBidCountdown($lane);

        $state = Cache::get("countdown:lane:{$lane->id}");
        $this->assertSame('pre_bid', $state['phase']);
    }

    public function test_stopCountdown_は_キャッシュを消す(): void
    {
        $lane = $this->makeLiveLane();
        app(CountdownService::class)->startCountdown($lane);
        $this->assertNotNull(Cache::get("countdown:lane:{$lane->id}"));

        app(CountdownService::class)->stopCountdown($lane->id);
        $this->assertNull(Cache::get("countdown:lane:{$lane->id}"));
    }

    public function test_startFreezeCountdown_は_phaseをfreezeにする(): void
    {
        $lane = $this->makeLiveLane();
        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);

        $svc->startFreezeCountdown($lane);
        $state = Cache::get("countdown:lane:{$lane->id}");
        $this->assertSame('freeze', $state['phase']);
    }

    public function test_startFreezeCountdown_は_キャッシュ未存在時は何もしない(): void
    {
        $lane = $this->makeLiveLane();
        // 起動せずに freeze を叩く
        app(CountdownService::class)->startFreezeCountdown($lane);
        $this->assertNull(Cache::get("countdown:lane:{$lane->id}"));
    }

    public function test_startBidCountdown_は_phaseをbiddingに切り替える(): void
    {
        $lane = $this->makeLiveLane();
        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);
        $svc->startFreezeCountdown($lane); // freeze
        $svc->startBidCountdown($lane);

        $state = Cache::get("countdown:lane:{$lane->id}");
        $this->assertSame('bidding', $state['phase']);
    }

    public function test_resetCountdown_は_startFreezeCountdownのエイリアス(): void
    {
        $lane = $this->makeLiveLane();
        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);
        $svc->resetCountdown($lane);

        $state = Cache::get("countdown:lane:{$lane->id}");
        $this->assertSame('freeze', $state['phase']);
    }

    public function test_pauseCountdown_は_is_runningをfalseにする(): void
    {
        $lane = $this->makeLiveLane();
        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);
        $svc->pauseCountdown($lane->id);

        $state = Cache::get("countdown:lane:{$lane->id}");
        $this->assertFalse($state['is_running']);
    }

    public function test_pauseCountdown_は_キャッシュなしなら何もしない(): void
    {
        // キャッシュなしの状態でも例外を投げない
        app(CountdownService::class)->pauseCountdown(99999);
        $this->assertNull(Cache::get('countdown:lane:99999'));
    }

    public function test_resumeCountdown_は_is_runningをtrueに戻す(): void
    {
        $lane = $this->makeLiveLane();
        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);
        $svc->pauseCountdown($lane->id);

        $svc->resumeCountdown($lane->id);
        $state = Cache::get("countdown:lane:{$lane->id}");
        $this->assertTrue($state['is_running']);
    }

    public function test_getCountdownState_は_キャッシュ内容を返す(): void
    {
        $lane = $this->makeLiveLane();
        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);

        $state = $svc->getCountdownState($lane->id);
        $this->assertIsArray($state);
        $this->assertSame($lane->id, $state['lane_id']);
    }

    public function test_getCountdownState_は_未起動でnull(): void
    {
        $this->assertNull(app(CountdownService::class)->getCountdownState(99999));
    }

    public function test_getActiveCountdowns_は_running中のレーンのみ返す(): void
    {
        $lane1 = $this->makeLiveLane();
        $lane2 = $this->makeLiveLane();
        // lane1 と lane2 は同じ auction 配下にしないので、別々のオークションに作られる
        // getActiveCountdowns は auction id 指定なので lane1 のみ拾われる
        $svc = app(CountdownService::class);
        $svc->startCountdown($lane1);
        $svc->startCountdown($lane2);
        $svc->pauseCountdown($lane2->id);

        $countdowns = $svc->getActiveCountdowns($lane1->auction_id);
        $this->assertArrayHasKey($lane1->id, $countdowns);
        $this->assertArrayNotHasKey($lane2->id, $countdowns);
    }

    public function test_getActiveCountdowns_は_存在しないauctionIdで空配列(): void
    {
        $this->assertSame([], app(CountdownService::class)->getActiveCountdowns(999999));
    }

    public function test_tick_は_キャッシュなしでnull(): void
    {
        $lane = $this->makeLiveLane();
        $this->assertNull(app(CountdownService::class)->tick($lane->id));
    }

    public function test_tick_は_pausedでnull(): void
    {
        $lane = $this->makeLiveLane();
        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);
        $svc->pauseCountdown($lane->id);

        $this->assertNull($svc->tick($lane->id));
    }

    public function test_tick_は_remaining_secondsを減らす(): void
    {
        $lane = $this->makeLiveLane();
        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);

        $before = Cache::get("countdown:lane:{$lane->id}")['remaining_seconds'];
        $result = $svc->tick($lane->id);
        $after = Cache::get("countdown:lane:{$lane->id}")['remaining_seconds'];

        $this->assertSame('tick', $result['action']);
        $this->assertEquals($before - CountdownService::TICK_INTERVAL, $after);
    }

    public function test_tick_は_currentItemがlive以外なら停止(): void
    {
        $lane = $this->makeLiveLane();
        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);

        // 商品を sold に変える
        $lane->currentItem->update(['status' => 'sold']);

        $this->assertNull($svc->tick($lane->id));
        $this->assertNull(Cache::get("countdown:lane:{$lane->id}"));
    }

    public function test_tick_は_カウントダウン終了時_入札者0でunsoldにする(): void
    {
        $lane = $this->makeLiveLane();
        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);

        // remaining_seconds を 0 にしてから tick
        $state = Cache::get("countdown:lane:{$lane->id}");
        $state['remaining_seconds'] = 0;
        Cache::put("countdown:lane:{$lane->id}", $state, 3600);

        $result = $svc->tick($lane->id);
        $this->assertSame('countdown_end', $result['action']);
        $this->assertSame('unsold', $result['result']);
        $this->assertSame('unsold', $lane->currentItem->fresh()->status);
    }

    public function test_tick_は_カウントダウン終了時_入札者1でsoldにする(): void
    {
        $lane = $this->makeLiveLane();
        $bidder = $this->createParticipant();
        \App\Models\BidParticipant::create([
            'item_id' => $lane->currentItem->id,
            'user_id' => $bidder->id,
            'is_active' => true,
            'activated_at' => now(),
        ]);

        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);

        $state = Cache::get("countdown:lane:{$lane->id}");
        $state['remaining_seconds'] = 0;
        Cache::put("countdown:lane:{$lane->id}", $state, 3600);

        $result = $svc->tick($lane->id);
        $this->assertSame('countdown_end', $result['action']);
        $this->assertSame('sold', $result['result']);
        $this->assertSame('sold', $lane->currentItem->fresh()->status);
        $this->assertDatabaseHas('won_items', [
            'item_id' => $lane->currentItem->id,
            'winner_id' => $bidder->id,
        ]);
    }

    public function test_tick_は_入札者2人以上で価格上昇しfreeze開始(): void
    {
        $lane = $this->makeLiveLane(10000);
        $b1 = $this->createParticipant();
        $b2 = $this->createParticipant();
        \App\Models\BidParticipant::create([
            'item_id' => $lane->currentItem->id, 'user_id' => $b1->id,
            'is_active' => true, 'activated_at' => now(),
        ]);
        \App\Models\BidParticipant::create([
            'item_id' => $lane->currentItem->id, 'user_id' => $b2->id,
            'is_active' => true, 'activated_at' => now(),
        ]);

        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);

        $state = Cache::get("countdown:lane:{$lane->id}");
        $state['remaining_seconds'] = 0;
        $state['last_bidder_user_id'] = $b2->id;
        Cache::put("countdown:lane:{$lane->id}", $state, 3600);

        $result = $svc->tick($lane->id);
        $this->assertSame('price_increment', $result['action']);

        // current_price が上昇
        $this->assertGreaterThan(10000, (int) $lane->currentItem->fresh()->current_price);

        // freeze フェーズに切り替わっている
        $this->assertSame('freeze', Cache::get("countdown:lane:{$lane->id}")['phase']);

        // 最後に入札したユーザー以外は離脱（落札権利者保護）
        $b1Active = \App\Models\BidParticipant::where('item_id', $lane->currentItem->id)
            ->where('user_id', $b1->id)->value('is_active');
        $this->assertFalse((bool) $b1Active);
        $b2Active = \App\Models\BidParticipant::where('item_id', $lane->currentItem->id)
            ->where('user_id', $b2->id)->value('is_active');
        $this->assertTrue((bool) $b2Active);
    }

    public function test_handleImmediatePriceIncrement_は_入札者2未満で何もしない(): void
    {
        $lane = $this->makeLiveLane();
        app(CountdownService::class)->handleImmediatePriceIncrement(
            $lane, $lane->currentItem, $lane->auction
        );
        $this->assertSame(10000, (int) $lane->currentItem->fresh()->current_price);
    }

    public function test_handleImmediatePriceIncrement_は_入札者2人で価格を上昇させる(): void
    {
        $lane = $this->makeLiveLane(10000);
        $b1 = $this->createParticipant();
        $b2 = $this->createParticipant();
        \App\Models\BidParticipant::create([
            'item_id' => $lane->currentItem->id, 'user_id' => $b1->id,
            'is_active' => true, 'activated_at' => now(),
        ]);
        \App\Models\BidParticipant::create([
            'item_id' => $lane->currentItem->id, 'user_id' => $b2->id,
            'is_active' => true, 'activated_at' => now(),
        ]);

        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);
        $svc->handleImmediatePriceIncrement($lane, $lane->currentItem, $lane->auction, $b2->id);

        $this->assertGreaterThan(10000, (int) $lane->currentItem->fresh()->current_price);
        $this->assertSame('freeze', Cache::get("countdown:lane:{$lane->id}")['phase']);
    }

    public function test_adjustPriceByBidLimits_は_指値2件未満で何もしない(): void
    {
        $lane = $this->makeLiveLane(10000);
        $u1 = $this->createParticipant();
        \App\Models\BidLimitPrice::create([
            'item_id' => $lane->currentItem->id, 'user_id' => $u1->id,
            'limit_price' => 30000, 'is_triggered' => false,
        ]);

        app(CountdownService::class)->adjustPriceByBidLimits(
            $lane->currentItem, $lane->auction, $lane
        );

        $this->assertSame(10000, (int) $lane->currentItem->fresh()->current_price);
    }

    public function test_adjustPriceByBidLimits_は_2件以上の指値で価格を最低指値超えまで引き上げる(): void
    {
        $lane = $this->makeLiveLane(10000);
        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);

        $u1 = $this->createParticipant();
        $u2 = $this->createParticipant();
        // u1 は最低指値、u2 はそれより高い指値
        \App\Models\BidLimitPrice::create([
            'item_id' => $lane->currentItem->id, 'user_id' => $u1->id,
            'limit_price' => 11000, 'is_triggered' => false,
        ]);
        \App\Models\BidLimitPrice::create([
            'item_id' => $lane->currentItem->id, 'user_id' => $u2->id,
            'limit_price' => 50000, 'is_triggered' => false,
        ]);

        $svc->adjustPriceByBidLimits($lane->currentItem, $lane->auction, $lane);

        // 価格は上昇している
        $this->assertGreaterThan(10000, (int) $lane->currentItem->fresh()->current_price);
        // u1 の指値は発動・削除されている（離脱処理 + 削除）
        $this->assertDatabaseMissing('bid_limit_prices', [
            'item_id' => $lane->currentItem->id,
            'user_id' => $u1->id,
        ]);
        // u2 の指値はまだ生きている
        $this->assertDatabaseHas('bid_limit_prices', [
            'item_id' => $lane->currentItem->id,
            'user_id' => $u2->id,
            'is_triggered' => false,
        ]);
    }

    public function test_adjustPriceByBidLimits_は_同額指値で先設定者を保護してアクティブのまま残す(): void
    {
        $lane = $this->makeLiveLane(10000);
        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);

        $earlier = $this->createParticipant();
        $later   = $this->createParticipant();
        // 両者を入札参加させる
        \App\Models\BidParticipant::create([
            'item_id' => $lane->currentItem->id, 'user_id' => $earlier->id,
            'is_active' => true, 'activated_at' => now()->subMinutes(10),
        ]);
        \App\Models\BidParticipant::create([
            'item_id' => $lane->currentItem->id, 'user_id' => $later->id,
            'is_active' => true, 'activated_at' => now()->subMinutes(5),
        ]);

        \App\Models\BidLimitPrice::create([
            'item_id' => $lane->currentItem->id, 'user_id' => $earlier->id,
            'limit_price' => 20000, 'is_triggered' => false,
            'created_at' => now()->subMinutes(10), 'updated_at' => now()->subMinutes(10),
        ]);
        \App\Models\BidLimitPrice::create([
            'item_id' => $lane->currentItem->id, 'user_id' => $later->id,
            'limit_price' => 20000, 'is_triggered' => false,
        ]);

        $svc->adjustPriceByBidLimits($lane->currentItem, $lane->auction, $lane);

        // 価格は同額指値（20000）まで上昇
        $this->assertSame(20000, (int) $lane->currentItem->fresh()->current_price);

        // 同額の指値はどちらも発動して削除されるが、
        // 先設定者は BidParticipant がアクティブのまま残る（落札権利保護）
        $earlierActive = \App\Models\BidParticipant::where('item_id', $lane->currentItem->id)
            ->where('user_id', $earlier->id)->value('is_active');
        $this->assertTrue((bool) $earlierActive, '先設定者はアクティブのまま残る');

        // 後発のユーザーは離脱させられる
        $laterActive = \App\Models\BidParticipant::where('item_id', $lane->currentItem->id)
            ->where('user_id', $later->id)->value('is_active');
        $this->assertFalse((bool) $laterActive, '後発者は離脱');
    }

    public function test_adjustPriceByBidLimits_は_live以外の商品で何もしない(): void
    {
        $lane = $this->makeLiveLane();
        $lane->currentItem->update(['status' => 'sold']);

        app(CountdownService::class)->adjustPriceByBidLimits(
            $lane->currentItem, $lane->auction, $lane
        );

        // status='sold' なので状態に変更がない
        $this->assertSame('sold', $lane->currentItem->fresh()->status);
    }
}
