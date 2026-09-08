<?php

namespace Tests\Unit\Services;

use App\Models\Auction;
use App\Models\BidParticipant;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Models\SystemSetting;
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

    /**
     * 負荷レビュー H5: pause→resume で phase='freeze' が残ると、
     * 再開後に入札ボタンが永続的に無効化される事故になる。resume 時に
     * freeze は bidding にリセットされる必要がある。
     */
    public function test_resumeCountdown_は_freezeフェーズをbiddingにリセットする(): void
    {
        $lane = $this->makeLiveLane();
        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);

        // freeze フェーズの状態を手動で再現
        $state = Cache::get("countdown:lane:{$lane->id}");
        $state['phase']             = 'freeze';
        $state['remaining_seconds'] = 1.5;
        Cache::put("countdown:lane:{$lane->id}", $state, 14400);

        $svc->pauseCountdown($lane->id);
        $svc->resumeCountdown($lane->id);

        $resumed = Cache::get("countdown:lane:{$lane->id}");
        $this->assertSame('bidding', $resumed['phase'], 'freeze は再開時に bidding に戻る必要がある');
        $this->assertGreaterThan(0, $resumed['remaining_seconds'], 'remaining_seconds は bidding 用に再設定される');
        $this->assertTrue($resumed['is_running']);
    }

    /**
     * 同じ resumeCountdown でも、bidding フェーズはそのまま継続される（残秒数を保持）。
     * pre_bid も商品切替直後の数秒なのでリセットされない。
     */
    public function test_resumeCountdown_は_biddingフェーズの残秒数を変更しない(): void
    {
        $lane = $this->makeLiveLane();
        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);

        $state = Cache::get("countdown:lane:{$lane->id}");
        $state['phase']             = 'bidding';
        $state['remaining_seconds'] = 2.5;
        Cache::put("countdown:lane:{$lane->id}", $state, 14400);

        $svc->pauseCountdown($lane->id);
        $svc->resumeCountdown($lane->id);

        $resumed = Cache::get("countdown:lane:{$lane->id}");
        $this->assertSame('bidding', $resumed['phase']);
        $this->assertSame(2.5, (float) $resumed['remaining_seconds']);
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

    /**
     * 即落札レース回帰テスト（2026-06-17 / item 1757 インシデント）。
     *
     * カウント0の瞬間に入札（JoinBidAction）が処理中だと、JoinBidAction は
     * bid_inflight ロックを価格上昇 commit まで保持する。その間 tick が確定すると
     * freeze→bidding の新ラウンドを飛ばして即落札してしまう事故が起きていた。
     * 修正後は、bid_inflight ロック保持中は tick が確定を見送る（商品は live のまま）。
     */
    public function test_tick_は_入札処理中ロック保持中は確定を見送り商品をliveのまま残す(): void
    {
        $lane = $this->makeLiveLane();
        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);

        $state = Cache::get("countdown:lane:{$lane->id}");
        $state['remaining_seconds'] = 0;
        Cache::put("countdown:lane:{$lane->id}", $state, 3600);

        // HTTP 側の入札処理中を模擬: JoinBidAction と同一キーのロックを保持する
        $itemId = $lane->current_item_id;
        $heldLock = Cache::lock("bid_inflight:item:{$itemId}", 5);
        $this->assertTrue($heldLock->get(), '前提: ロックを取得できること');

        try {
            $result = $svc->tick($lane->id);

            // 確定されず見送られ、商品は live のまま（誤落札/誤流札しない）
            $this->assertSame('finalize_deferred', $result['action']);
            $this->assertSame('live', $lane->currentItem->fresh()->status);
        } finally {
            $heldLock->release();
        }

        // ロック解放後の次tickでは正常に確定する（入札者0なので流札）
        $result2 = $svc->tick($lane->id);
        $this->assertSame('countdown_end', $result2['action']);
        $this->assertSame('unsold', $lane->currentItem->fresh()->status);
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

    public function test_adjustPriceByBidLimits_は_現在価格と同額の指値タイでも後発者を離脱させる(): void
    {
        // 現在価格 == 同額指値 のケース（開始価格ちょうどの指値が2件など）。
        // 価格が上がらないため、旧版は早期 return して後発者の脱落処理に到達せず、
        // 両者 active のまま膠着していた。
        $lane = $this->makeLiveLane(1400);
        $svc = app(CountdownService::class);
        $svc->startCountdown($lane);

        $earlier = $this->createParticipant();
        $later   = $this->createParticipant();
        \App\Models\BidParticipant::create([
            'item_id' => $lane->currentItem->id, 'user_id' => $earlier->id,
            'is_active' => true, 'activated_at' => now()->subMinutes(10),
        ]);
        \App\Models\BidParticipant::create([
            'item_id' => $lane->currentItem->id, 'user_id' => $later->id,
            'is_active' => true, 'activated_at' => now()->subMinutes(5),
        ]);

        // 両者とも現在価格ちょうどの指値
        \App\Models\BidLimitPrice::create([
            'item_id' => $lane->currentItem->id, 'user_id' => $earlier->id,
            'limit_price' => 1400, 'is_triggered' => false,
            'created_at' => now()->subMinutes(10), 'updated_at' => now()->subMinutes(10),
        ]);
        \App\Models\BidLimitPrice::create([
            'item_id' => $lane->currentItem->id, 'user_id' => $later->id,
            'limit_price' => 1400, 'is_triggered' => false,
        ]);

        $svc->adjustPriceByBidLimits($lane->currentItem, $lane->auction, $lane);

        // 同額タイでは競り上げないので価格は据え置き
        $this->assertSame(1400, (int) $lane->currentItem->fresh()->current_price);

        // 先設定者は落札権利者として active のまま、指値も生きている
        $earlierActive = \App\Models\BidParticipant::where('item_id', $lane->currentItem->id)
            ->where('user_id', $earlier->id)->value('is_active');
        $this->assertTrue((bool) $earlierActive, '先設定者はアクティブのまま残る');
        $this->assertDatabaseHas('bid_limit_prices', [
            'item_id' => $lane->currentItem->id, 'user_id' => $earlier->id, 'is_triggered' => false,
        ]);

        // 後発者は離脱し、指値は削除される（再入札をブロックしないため）
        $laterActive = \App\Models\BidParticipant::where('item_id', $lane->currentItem->id)
            ->where('user_id', $later->id)->value('is_active');
        $this->assertFalse((bool) $laterActive, '後発者は離脱');
        $this->assertDatabaseMissing('bid_limit_prices', [
            'item_id' => $lane->currentItem->id, 'user_id' => $later->id,
        ]);
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

    /**
     * DEV-2026-008 回帰テスト（2026-06-19 item 1875 / 1843 / 1936 の即落札事故）。
     *
     * 通常 bidding tick の書き戻し直前ガード `shouldSkipBiddingWriteback` が、
     * 並行入札由来の freeze / 世代交代 / 一時停止を検知して「上書き見送り」を返すことを検証する。
     * これが false を返して古い bidding state を書き戻すと、freeze を潰して新ラウンドを飛ばし即落札する。
     */
    public function test_shouldSkipBiddingWriteback_は_freeze等の割り込みを検知して上書きを見送る(): void
    {
        $lane = $this->makeLiveLane();
        $item = $lane->currentItem;
        $svc  = app(CountdownService::class);
        $key  = "countdown:lane:{$lane->id}";

        $method = new \ReflectionMethod($svc, 'shouldSkipBiddingWriteback');
        $method->setAccessible(true);

        // 1) 並行入札が freeze を書いた → 上書き見送り(true)。これが本事故の核心。
        Cache::put($key, ['phase' => 'freeze', 'item_id' => $item->id, 'is_running' => true, 'remaining_seconds' => 2], 3600);
        $this->assertTrue($method->invoke($svc, $lane->id, $item->id), 'freeze 割り込み時は書き戻しを見送る');

        // 2) 通常の bidding 継続 → 従来どおり書き戻す(false)。ホットパスを壊さないことの確認。
        Cache::put($key, ['phase' => 'bidding', 'item_id' => $item->id, 'is_running' => true, 'remaining_seconds' => 5], 3600);
        $this->assertFalse($method->invoke($svc, $lane->id, $item->id), 'bidding 継続中は通常どおり書き戻す');

        // 3) 世代交代で別 item に切替済み → 古い item の書き戻しを見送り(true)。
        Cache::put($key, ['phase' => 'bidding', 'item_id' => $item->id + 999, 'is_running' => true, 'remaining_seconds' => 5], 3600);
        $this->assertTrue($method->invoke($svc, $lane->id, $item->id), 'item 切替後は古い item の書き戻しを見送る');

        // 4) 一時停止中 → 書き戻さない(true)。
        Cache::put($key, ['phase' => 'bidding', 'item_id' => $item->id, 'is_running' => false, 'remaining_seconds' => 5], 3600);
        $this->assertTrue($method->invoke($svc, $lane->id, $item->id), '一時停止中は書き戻さない');

        // 5) キャッシュ未存在 → 従来挙動を維持して書き戻す(false)。
        Cache::forget($key);
        $this->assertFalse($method->invoke($svc, $lane->id, $item->id), 'キャッシュ未存在は従来挙動を維持');
    }

    // ---- B-6 (2026-09-08): カウントダウン配信間隔の縮退スイッチ ----

    private function setTickInterval(string $value): void
    {
        SystemSetting::updateOrCreate(['setting_key' => 'live_tick_broadcast_interval'], [
            'setting_value' => $value, 'value_type' => 'integer',
            'category' => 'live_operation', 'display_name' => 'x', 'description' => '', 'is_public' => false,
        ]);
        SystemSetting::clearCache();
    }

    private function shouldBroadcast(float $remaining): bool
    {
        $svc = app(CountdownService::class);
        $m = new \ReflectionMethod($svc, 'shouldBroadcastLowFrequency');
        return $m->invoke($svc, $remaining);
    }

    public function test_shouldBroadcastLowFrequency_は_設定なしなら整数秒ごとに配信する(): void
    {
        $this->assertTrue($this->shouldBroadcast(10.0));
        $this->assertTrue($this->shouldBroadcast(9.0));
        $this->assertFalse($this->shouldBroadcast(9.5), '半秒は間引く');
        $this->assertTrue($this->shouldBroadcast(0.0));
    }

    public function test_shouldBroadcastLowFrequency_は_配信間隔3なら3秒ごと_残り3秒以下は毎秒(): void
    {
        $this->setTickInterval('3');
        $this->assertTrue($this->shouldBroadcast(9.0));
        $this->assertFalse($this->shouldBroadcast(8.0));
        $this->assertFalse($this->shouldBroadcast(7.0));
        $this->assertTrue($this->shouldBroadcast(6.0));
        $this->assertFalse($this->shouldBroadcast(6.5), '半秒は設定に関係なく間引く');
        $this->assertTrue($this->shouldBroadcast(3.0));
        $this->assertTrue($this->shouldBroadcast(2.0), '残り3秒以下は毎秒');
        $this->assertTrue($this->shouldBroadcast(1.0));
        $this->assertTrue($this->shouldBroadcast(0.0));
    }

    public function test_shouldBroadcastLowFrequency_は_不正な設定値は毎秒扱い(): void
    {
        $this->setTickInterval('0');
        $this->assertTrue($this->shouldBroadcast(8.0));
        $this->assertTrue($this->shouldBroadcast(7.0));
    }
}
