<?php

namespace Tests\Unit\Services;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Services\CountdownService;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * R3 (2026-09-14): 確定後にレーンが止まった経路（経路 B）の復旧 — CountdownService::recoverStalledLane。
 *
 * handleCountdownEnd の Step 1（落札/流札の commit）は済んだのに Step 2（moveToNextItem）が失敗すると、
 * レーンは active のまま売れた商品を指し続け、カウントダウン状態も無い。9/10 のコード精査で発見（未対処だった）。
 */
class CountdownServiceStallRecoveryTest extends TestCase
{
    private Auction $auction;
    private Lane $lane;
    private Item $sold;
    private Item $next;
    private Item $after;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Cache::flush();

        $admin   = $this->createAdmin();
        $seller  = $this->createSeller();
        $profile = SellerProfile::factory()->create(['user_id' => $seller->id]);

        $this->auction = Auction::factory()->live()->create(['created_by' => $admin->id]);
        $this->lane    = Lane::factory()->active()->create(['auction_id' => $this->auction->id, 'lane_number' => 1]);

        $make = fn (string $status, int $n) => Item::factory()->create([
            'auction_id' => $this->auction->id, 'seller_profile_id' => $profile->id, 'status' => $status,
            'item_number' => $n, 'start_price' => 1000, 'current_price' => 1000,
        ]);
        $this->sold  = $make('sold', 1);
        $this->next  = $make('registered', 2);
        $this->after = $make('registered', 3);
        $this->lane->items()->attach($this->sold->id, ['sequence_order' => 1]);
        $this->lane->items()->attach($this->next->id, ['sequence_order' => 2]);
        $this->lane->items()->attach($this->after->id, ['sequence_order' => 3]);
        $this->lane->update(['current_item_id' => $this->sold->id]);
        Cache::forget("countdown:lane:{$this->lane->id}");
    }

    private function service(): CountdownService
    {
        return app(CountdownService::class);
    }

    public function test_確定済みの商品を指したままのレーンを次の商品へ進める(): void
    {
        $r = $this->service()->recoverStalledLane($this->lane);

        $this->assertTrue($r['recovered'], $r['reason']);
        $this->assertSame('moved', $r['reason']);
        $this->assertSame($this->next->id, $r['next_item_id']);

        $lane = $this->lane->fresh();
        $this->assertSame($this->next->id, $lane->current_item_id);
        $this->assertSame('active', $lane->status);
        $this->assertSame('live', $this->next->fresh()->status);
        $this->assertSame('sold', $this->sold->fresh()->status);

        // 入札開始待機のカウントダウンが書かれている
        $state = Cache::get("countdown:lane:{$this->lane->id}");
        $this->assertNotNull($state);
        $this->assertSame($this->next->id, $state['item_id']);
        $this->assertSame('pre_bid', $state['phase']);
    }

    public function test_宙に浮いたlive商品があれば飛ばさずに拾い直す(): void
    {
        // 前回の moveToNextItem が「次商品を live にした直後」に失敗した状態を再現
        $this->next->update(['status' => 'live']);

        $r = $this->service()->recoverStalledLane($this->lane);

        $this->assertTrue($r['recovered'], $r['reason']);
        $this->assertSame($this->next->id, $r['next_item_id'], '3 番目の商品へ飛ばさず 2 番目を拾う');
        $this->assertSame($this->next->id, $this->lane->fresh()->current_item_id);
        $this->assertSame('live', $this->next->fresh()->status);
        $this->assertSame('registered', $this->after->fresh()->status);
    }

    public function test_現在商品がliveなら何もしない(): void
    {
        $this->sold->update(['status' => 'live']);

        $r = $this->service()->recoverStalledLane($this->lane);

        $this->assertFalse($r['recovered']);
        $this->assertSame('item_still_live', $r['reason']);
        $this->assertSame($this->sold->id, $this->lane->fresh()->current_item_id);
        $this->assertSame('registered', $this->next->fresh()->status);
    }

    public function test_レーンがactiveでなければ何もしない(): void
    {
        $this->lane->update(['status' => 'paused']);

        $r = $this->service()->recoverStalledLane($this->lane);

        $this->assertFalse($r['recovered']);
        $this->assertSame('lane_not_active', $r['reason']);
        $this->assertSame('registered', $this->next->fresh()->status);
    }

    public function test_残りの商品が無ければレーンを終了する(): void
    {
        $this->next->update(['status' => 'unsold']);
        $this->after->update(['status' => 'cancelled']);

        $r = $this->service()->recoverStalledLane($this->lane);

        $this->assertTrue($r['recovered'], $r['reason']);
        $this->assertSame('lane_finished', $r['reason']);
        $lane = $this->lane->fresh();
        $this->assertSame('finished', $lane->status);
        $this->assertNull($lane->current_item_id);
    }

    public function test_同じレーンを同時に直そうとしても片方は待たされる(): void
    {
        $lock = Cache::lock("lane_stall_recover:{$this->lane->id}", 30);
        $this->assertTrue($lock->get());
        try {
            $r = $this->service()->recoverStalledLane($this->lane);
            $this->assertFalse($r['recovered']);
            $this->assertSame('locked', $r['reason']);
            $this->assertSame($this->sold->id, $this->lane->fresh()->current_item_id);
        } finally {
            $lock->release();
        }
    }
}
