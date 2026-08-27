<?php

namespace Tests\Unit\Services;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Services\BidService;
use App\Services\CountdownService;
use Illuminate\Support\Facades\Cache;
use Mockery;
use Tests\TestCase;

/**
 * DEV-2026-011: getLiveState の cache-miss 復旧パス（recoverCountdownIfMissing）
 *
 * 2026-08-14 第7回 lane 113 の停止を決定的に再現し、修正が
 *   R1 refresh で今の商品を見る / R2 live 限定 / R3 Cache::add で上書きしない
 * を満たすことを検証する。
 */
class CountdownServiceRecoveryTest extends TestCase
{
    /** @return array{0: Auction, 1: Lane, 2: Item} */
    private function makeLiveLane(): array
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);
        $lane    = Lane::factory()->create([
            'auction_id'      => $auction->id,
            'status'          => 'active',
            'current_item_id' => $item->id,
        ]);

        return [$auction, $lane, $item];
    }

    private function key(Lane $lane): string
    {
        return "countdown:lane:{$lane->id}";
    }

    private function service(): CountdownService
    {
        return app(CountdownService::class);
    }

    /** T1: キャッシュ空・現商品 live → 書く */
    public function test_t1_writes_bidding_state_when_cache_is_empty_and_item_is_live(): void
    {
        [, $lane, $item] = $this->makeLiveLane();
        Cache::forget($this->key($lane));

        $this->assertTrue($this->service()->recoverCountdownIfMissing($lane));

        $state = Cache::get($this->key($lane));
        $this->assertSame($item->id, $state['item_id']);
        $this->assertSame('bidding', $state['phase']);
        $this->assertTrue($state['is_running']);
    }

    /**
     * T2: 2026-08-14 の再現。
     * 遷移前にロードした古い lane（current_item=A）で復旧を呼んでも、
     * tick が書いた Pre-bid(B) を上書きしない（R3）。
     */
    public function test_t2_does_not_overwrite_pre_bid_written_by_tick_when_called_with_stale_lane(): void
    {
        [$auction, $lane, $itemA] = $this->makeLiveLane();

        // リクエスト冒頭でロードされた古い lane モデル（current_item = A, A は live）
        $stale = Lane::with('currentItem')->find($lane->id);
        $this->assertSame($itemA->id, $stale->currentItem->id);

        // 遷移: A 落札 → B が live → lane.current_item = B → tick が Pre-bid(B) を書く
        $itemB = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);
        Item::whereKey($itemA->id)->update(['status' => 'sold']);
        Lane::whereKey($lane->id)->update(['current_item_id' => $itemB->id]);
        $preBid = [
            'lane_id' => $lane->id, 'item_id' => $itemB->id, 'auction_id' => $auction->id,
            'phase' => 'pre_bid', 'remaining_seconds' => 7, 'is_running' => true,
        ];
        Cache::put($this->key($lane), $preBid, CountdownService::CACHE_TTL);

        // 古い lane で復旧 → 既にキーがあるので書かない
        $this->assertFalse($this->service()->recoverCountdownIfMissing($stale));

        $state = Cache::get($this->key($lane));
        $this->assertSame($itemB->id, $state['item_id'], 'Pre-bid(B) が旧商品 A で上書きされてはならない');
        $this->assertSame('pre_bid', $state['phase']);
    }

    /**
     * T6(R1): キャッシュが本当に空で、古い lane を渡されても、
     * refresh 後の「今の商品 B」で書く（旧商品 A では書かない）。
     */
    public function test_t6_uses_refreshed_current_item_not_the_stale_one(): void
    {
        [$auction, $lane, $itemA] = $this->makeLiveLane();
        $stale = Lane::with('currentItem')->find($lane->id);

        $itemB = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);
        Item::whereKey($itemA->id)->update(['status' => 'sold']);
        Lane::whereKey($lane->id)->update(['current_item_id' => $itemB->id]);
        Cache::forget($this->key($lane));

        $this->assertTrue($this->service()->recoverCountdownIfMissing($stale));

        $state = Cache::get($this->key($lane));
        $this->assertSame($itemB->id, $state['item_id']);
        $this->assertNotSame($itemA->id, $state['item_id']);
    }

    /** T3(R2): refresh 後の現商品が sold → 何も書かない */
    public function test_t3_does_not_write_when_current_item_is_not_live(): void
    {
        [, $lane, $itemA] = $this->makeLiveLane();
        $stale = Lane::with('currentItem')->find($lane->id);

        Item::whereKey($itemA->id)->update(['status' => 'sold']);
        Cache::forget($this->key($lane));

        $this->assertFalse($this->service()->recoverCountdownIfMissing($stale));
        $this->assertNull(Cache::get($this->key($lane)));
    }

    /** T4(R2): lane が active でない → 何も書かない */
    public function test_t4_does_not_write_when_lane_is_not_active(): void
    {
        [, $lane] = $this->makeLiveLane();
        Lane::whereKey($lane->id)->update(['status' => 'waiting']);
        Cache::forget($this->key($lane));

        $this->assertFalse($this->service()->recoverCountdownIfMissing($lane));
        $this->assertNull(Cache::get($this->key($lane)));
    }

    /** T5: startCountdown と同キー・同構造（started_at 以外）→ tick がそのまま消費できる */
    public function test_t5_writes_same_structure_as_start_countdown(): void
    {
        [, $lane] = $this->makeLiveLane();

        $this->service()->startCountdown($lane);
        $viaStart = Cache::get($this->key($lane));
        Cache::forget($this->key($lane));

        $this->assertTrue($this->service()->recoverCountdownIfMissing($lane));
        $viaRecover = Cache::get($this->key($lane));

        unset($viaStart['started_at'], $viaRecover['started_at']);
        $this->assertSame($viaStart, $viaRecover);
    }

    /** T7(R4): getLiveState の cache-miss 時は recover 版だけを呼び、startCountdown は呼ばない */
    public function test_t7_get_live_state_calls_recover_not_start_countdown_on_cache_miss(): void
    {
        [$auction, $lane] = $this->makeLiveLane();
        Cache::forget($this->key($lane));

        $mock = Mockery::mock(CountdownService::class);
        $mock->shouldReceive('recoverCountdownIfMissing')->once()->andReturn(false);
        $mock->shouldNotReceive('startCountdown');
        $this->app->instance(CountdownService::class, $mock);

        app(BidService::class)->getLiveState($auction->fresh());
    }
}
