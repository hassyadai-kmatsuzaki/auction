<?php

namespace Tests\Unit\Actions;

use App\Actions\Bid\JoinBidAction;
use App\Models\Auction;
use App\Models\BidEvent;
use App\Models\BidLimitPrice;
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

    /**
     * @test
     * 単方向入札仕様: 自分が既に active な状態で再度押下しても冪等成功で吸収する。
     * （フロント disable 漏れや楽観更新ズレで二重リクエストが届いても DB を二重に書かない）
     */
    public function test_既にactiveな自分の二重押下は冪等成功で吸収される(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);
        $userId  = 1;

        BidParticipant::create([
            'item_id'    => $item->id,
            'user_id'    => $userId,
            'is_active'  => true,
            'activated_at' => now(),
        ]);

        $result = $this->action->execute($item, $userId);

        $this->assertTrue($result->success);
        $this->assertSame(1, BidEvent::where('item_id', $item->id)->where('user_id', $userId)->where('event_type', BidEvent::TYPE_JOIN)->count(),
            '冪等成功時は recordJoin が新たに発行されないこと（既存ゼロのまま）'
        );
        $this->assertDatabaseHas('bid_participants', [
            'item_id' => $item->id, 'user_id' => $userId, 'is_active' => true,
        ]);
    }

    /**
     * @test
     * 指値あり商品で他者（指値者）が active な状態でも、後続の入札は受理される。
     *
     * 旧仕様は「他者active時は ignored で弾く」だったが、A が指値登録だけで auto-active 化された
     * （価格上昇/freeze 未発火）状態で B が弾かれると、価格が刻み上昇しないまま countdown が
     * 終了し A が start_price 落札してしまうバグがあった。修正後は B のクリックを受け入れ、
     * handleImmediatePriceIncrement で価格上昇＋指値者保護の対抗フローに乗せる。
     *
     * ※ 価格上昇/holder保護のロジックは Lane 必須なので CountdownService 側のテストに委ね、
     *    本テストは「入口で弾かない／TYPE_IGNORED を残さない」だけに絞る。
     */
    public function test_指値あり商品でも他者の入札は受理されignoredは記録されない(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);

        // 指値（is_triggered=false）が A 名義で登録されている前提
        $userA = 10;
        BidLimitPrice::create([
            'item_id'      => $item->id,
            'user_id'      => $userA,
            'limit_price'  => 99999,
            'is_triggered' => false,
        ]);

        // SetBidLimitAction の auto-bid 経路で A が active 化された状態を再現
        BidParticipant::create([
            'item_id'    => $item->id,
            'user_id'    => $userA,
            'is_active'  => true,
            'activated_at' => now(),
        ]);

        // 後続の B が入札ボタンを押す
        $userB = 20;
        $result = $this->action->execute($item, $userB);

        $this->assertTrue($result->success);
        $this->assertDatabaseHas('bid_participants', [
            'item_id' => $item->id, 'user_id' => $userB, 'is_active' => true,
        ]);
        $this->assertDatabaseMissing('bid_events', [
            'item_id'    => $item->id,
            'user_id'    => $userB,
            'event_type' => 'ignored',
        ]);
    }

    /**
     * @test
     * 単方向入札仕様（指値なし商品）: 1人目押下では active 登録のみで価格上昇しない。
     * 2人目押下で初めて即時価格上昇＋フリーズが発動する（従来動作の維持）。
     */
    public function test_指値なし商品の1人目押下は価格上昇せずactive登録のみ(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create([
            'auction_id'    => $auction->id,
            'status'        => 'live',
            'current_price' => 1000,
        ]);

        $result = $this->action->execute($item, 1);

        $this->assertTrue($result->success);
        $this->assertSame(1000.0, (float) $item->fresh()->current_price);
        $this->assertDatabaseHas('bid_participants', [
            'item_id' => $item->id, 'user_id' => 1, 'is_active' => true,
        ]);
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
