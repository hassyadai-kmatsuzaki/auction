<?php

namespace Tests\Unit\Actions;

use App\Actions\Bid\SetBidLimitAction;
use App\Events\BidderUpdated;
use App\Models\Auction;
use App\Models\BidEvent;
use App\Models\BidLimitPrice;
use App\Models\BidParticipant;
use App\Models\Favorite;
use App\Models\Item;
use App\Models\Lane;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class SetBidLimitActionTest extends TestCase
{
    private SetBidLimitAction $action;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->action = app(SetBidLimitAction::class);
    }

    public function test_指値設定時にお気に入りが自動追加される(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'registered', 'current_price' => 100]);
        $userId  = $this->createParticipant()->id;

        $result = $this->action->execute($item, $userId, 500);

        $this->assertTrue($result->success);
        $this->assertDatabaseHas('favorites', [
            'user_id' => $userId,
            'item_id' => $item->id,
        ]);
    }

    public function test_指値解除時にお気に入りも自動削除される(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'registered', 'current_price' => 100]);
        $userId  = $this->createParticipant()->id;

        $this->action->execute($item, $userId, 500);
        $this->assertDatabaseHas('favorites', ['user_id' => $userId, 'item_id' => $item->id]);

        $this->action->remove($item, $userId);

        $this->assertDatabaseMissing('favorites', [
            'user_id' => $userId,
            'item_id' => $item->id,
        ]);
        $this->assertDatabaseMissing('bid_limit_prices', [
            'user_id' => $userId,
            'item_id' => $item->id,
        ]);
    }

    public function test_指値設定で既存のお気に入りが重複しない(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'registered', 'current_price' => 100]);
        $userId  = $this->createParticipant()->id;

        Favorite::create(['user_id' => $userId, 'item_id' => $item->id]);

        $result = $this->action->execute($item, $userId, 500);

        $this->assertTrue($result->success);
        $this->assertEquals(1, Favorite::where('user_id', $userId)->where('item_id', $item->id)->count());
    }

    public function test_上限価格は1円以上必須(): void
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live', 'current_price' => 100]);
        $userId  = $this->createParticipant()->id;

        $result = $this->action->execute($item, $userId, 0);

        $this->assertFalse($result->success);
    }

    /**
     * 負荷レビュー H2: activatePendingBidLimits は複数ユーザーを activate しても
     * `BidderUpdated` の broadcast を **1回だけ** 発火する。
     * 旧版は foreach 内 DB::afterCommit で N回発火していた（active_bidders_count 過大表示の原因）。
     */
    public function test_activatePendingBidLimitsは複数ユーザーを一括activateしてbroadcastは1回(): void
    {
        Event::fake([BidderUpdated::class]);

        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create([
            'auction_id'    => $auction->id,
            'status'        => 'live',
            'current_price' => 1000,
        ]);
        $lane    = Lane::factory()->create([
            'auction_id'      => $auction->id,
            'current_item_id' => $item->id,
        ]);

        // 3名の指値ユーザーを準備（全員 limit_price > current_price）
        $userIds = [];
        for ($i = 0; $i < 3; $i++) {
            $u = $this->createParticipant();
            $userIds[] = $u->id;
            BidLimitPrice::create([
                'item_id'      => $item->id,
                'user_id'      => $u->id,
                'limit_price'  => 5000 + $i * 100,
                'is_triggered' => false,
            ]);
        }

        $count = $this->action->activatePendingBidLimits($item->fresh());

        $this->assertSame(3, $count, '3名が activate される');

        // 各ユーザーが is_active=true で登録されている
        foreach ($userIds as $uid) {
            $this->assertDatabaseHas('bid_participants', [
                'item_id' => $item->id, 'user_id' => $uid, 'is_active' => true,
            ]);
            $this->assertDatabaseHas('bid_events', [
                'item_id' => $item->id, 'user_id' => $uid, 'event_type' => BidEvent::TYPE_JOIN,
            ]);
        }

        // ★ broadcast は activate 件数に関係なく 1 回だけ
        Event::assertDispatchedTimes(BidderUpdated::class, 1);
    }

    /**
     * 既に active な参加者がいる場合は activate せずスキップする
     * （N+1 排除のための一括 alreadyActiveSet 判定の正常系）
     */
    public function test_activatePendingBidLimitsは既にactiveな参加者をスキップする(): void
    {
        Event::fake([BidderUpdated::class]);

        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create([
            'auction_id'    => $auction->id,
            'status'        => 'live',
            'current_price' => 1000,
        ]);
        Lane::factory()->create([
            'auction_id'      => $auction->id,
            'current_item_id' => $item->id,
        ]);

        $userIdActive  = $this->createParticipant()->id;
        $userIdPending = $this->createParticipant()->id;

        // 既に active な指値ユーザー
        BidLimitPrice::create([
            'item_id' => $item->id, 'user_id' => $userIdActive, 'limit_price' => 5000, 'is_triggered' => false,
        ]);
        BidParticipant::create([
            'item_id' => $item->id, 'user_id' => $userIdActive, 'is_active' => true, 'activated_at' => now(),
        ]);

        // まだ activate されていない指値ユーザー
        BidLimitPrice::create([
            'item_id' => $item->id, 'user_id' => $userIdPending, 'limit_price' => 5000, 'is_triggered' => false,
        ]);

        $count = $this->action->activatePendingBidLimits($item->fresh());

        $this->assertSame(1, $count, '既に active な1名は除外され、新規1名だけ activate');
        Event::assertDispatchedTimes(BidderUpdated::class, 1);
    }
}
