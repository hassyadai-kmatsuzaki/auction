<?php

namespace Tests\Unit\Actions;

use App\Actions\Bid\JoinBidAction;
use App\Models\Auction;
use App\Models\BidParticipant;
use App\Models\Item;
use App\Models\Lane;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class JoinBidActionTest extends TestCase
{
    use RefreshDatabase;

    private JoinBidAction $action;

    protected function setUp(): void
    {
        parent::setUp();
        $this->action = app(JoinBidAction::class);
    }

    /** @test */
    public function test_ライブ中の商品に入札参加できる(): void
    {
        $auction     = Auction::factory()->create(['status' => 'live']);
        $item        = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);
        $userId      = 1;

        $result = $this->action->execute($item, $userId);

        $this->assertTrue($result->success);
        $this->assertDatabaseHas('bid_participants', [
            'item_id'   => $item->id,
            'user_id'   => $userId,
            'is_active' => true,
        ]);
    }

    /** @test */
    public function test_ライブでない商品には入札参加できない(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'sold']);

        $result = $this->action->execute($item, 1);

        $this->assertFalse($result->success);
        $this->assertStringContainsString('入札を受け付けていません', $result->message);
    }

    /** @test */
    public function test_オークションがライブでない場合は入札参加できない(): void
    {
        $auction = Auction::factory()->create(['status' => 'scheduled']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);

        $result = $this->action->execute($item, 1);

        $this->assertFalse($result->success);
        $this->assertStringContainsString('開催中ではありません', $result->message);
    }

    /** @test */
    public function test_pre_bidフェーズ中は入札参加できない(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);
        $lane    = Lane::factory()->create(['auction_id' => $auction->id, 'current_item_id' => $item->id]);

        Cache::put("countdown:lane:{$lane->id}", [
            'phase'             => 'pre_bid',
            'remaining_seconds' => 3.0,
            'is_running'        => true,
        ], 60);

        $result = $this->action->execute($item, 1);

        $this->assertFalse($result->success);
        $this->assertStringContainsString('入札開始待機中', $result->message);
    }

    /** @test */
    public function test_freezeフェーズ中は入札参加できない(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);
        $lane    = Lane::factory()->create(['auction_id' => $auction->id, 'current_item_id' => $item->id]);

        Cache::put("countdown:lane:{$lane->id}", [
            'phase'             => 'freeze',
            'remaining_seconds' => 5.0,
            'is_running'        => true,
        ], 60);

        $result = $this->action->execute($item, 1);

        $this->assertFalse($result->success);
        $this->assertStringContainsString('誤タップ防止中', $result->message);
    }

    /** @test */
    public function test_他のユーザーが入札処理中なら拒否される(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);

        // 先行 Join がまだ Cache::lock を保持している状態をシミュレート
        $heldLock = Cache::lock("bid_inflight:item:{$item->id}", 5);
        $this->assertTrue($heldLock->get(), '先行ロックの取得に失敗');

        try {
            $result = $this->action->execute($item, 999);
            $this->assertFalse($result->success);
            $this->assertStringContainsString('処理中', $result->message);
        } finally {
            $heldLock->release();
        }
    }

    /** @test */
    public function test_ロック解放後は入札参加できる(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);

        $heldLock = Cache::lock("bid_inflight:item:{$item->id}", 5);
        $heldLock->get();
        $heldLock->release();

        $result = $this->action->execute($item, 1);
        $this->assertTrue($result->success);
    }

    /** @test */
    public function test_ロック取得から実処理までの間に価格が変わると拒否される(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create([
            'auction_id'    => $auction->id,
            'status'        => 'live',
            'current_price' => 10000,
        ]);

        // BidController が findOrFail した直後に他者の IncPrice が走った状況を再現:
        // $item インスタンスの current_price は古い値、DB は新しい値
        $item->current_price = 10000; // クライアントが見ていた価格
        // DB 側だけ更新（$item->update を使うと $item インスタンスも更新されてしまうため直接クエリ）
        \App\Models\Item::where('id', $item->id)->update(['current_price' => 11000]);

        $result = $this->action->execute($item, 1);

        $this->assertFalse($result->success);
        $this->assertStringContainsString('価格が更新されました', $result->message);
    }
}
