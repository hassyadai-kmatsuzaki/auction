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

        // 2026-11-12 上位2件だけ計算対象: 開始時の並べ直しで最高額2名（5200, 5100）だけが activate され、
        // 3人目（5000）はダミー → 開始後に FinishDummyLimitsJob（sync）で終了扱いになる
        $this->assertSame(2, $count, '上位2名が activate される');
        $this->assertDatabaseMissing('bid_participants', ['item_id' => $item->id, 'user_id' => $userIds[0]]);
        $this->assertDatabaseMissing('bid_limit_prices', ['item_id' => $item->id, 'user_id' => $userIds[0]]);

        // 各ユーザーが is_active=true で登録されている
        foreach (array_slice($userIds, 1) as $uid) {
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

    /**
     * 2026-08-26 変更（第7回 item 3079 不落札の再発防止）:
     * ライブ中に唯一の落札権利者が指値を解除しても、入札状態（active）は維持される。
     * 旧版は LeaveBidAction で離脱させていたため active 0 人 → 流札になっていた。
     */
    public function test_ライブ中に指値を解除しても入札状態は維持される(): void
    {
        Event::fake();

        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create([
            'auction_id'    => $auction->id,
            'status'        => 'live',
            'current_price' => 210,
        ]);
        Lane::factory()->create([
            'auction_id'      => $auction->id,
            'current_item_id' => $item->id,
        ]);
        $userId = $this->createParticipant()->id;

        // 事前指値 → 自動入札で active になっている状態を再現
        BidLimitPrice::create([
            'item_id' => $item->id, 'user_id' => $userId, 'limit_price' => 8000, 'is_triggered' => false,
        ]);
        BidParticipant::participate($item->id, $userId, true, null, 'auto-bid-from-limit');
        Favorite::create(['user_id' => $userId, 'item_id' => $item->id]);

        $result = $this->action->remove($item, $userId);

        $this->assertTrue($result->success);
        $this->assertDatabaseHas('bid_participants', [
            'item_id' => $item->id, 'user_id' => $userId, 'is_active' => true,
        ]);
        $this->assertDatabaseMissing('bid_limit_prices', ['item_id' => $item->id, 'user_id' => $userId]);
        $this->assertDatabaseMissing('favorites', ['item_id' => $item->id, 'user_id' => $userId]);
        $this->assertDatabaseMissing('bid_events', [
            'item_id' => $item->id, 'user_id' => $userId, 'event_type' => 'leave',
        ]);
    }

    // ─── 2026-11-12: ライブ中に落札権利者が指値を現在価格より低く下げる操作を拒否 ───

    /** @return array{Item, int} live 商品（現在価格 210）と、指値 8000 で active な参加者 */
    private function makeLiveItemWithActiveLimitUser(): array
    {
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live', 'current_price' => 210]);
        Lane::factory()->create(['auction_id' => $auction->id, 'current_item_id' => $item->id]);
        $userId = $this->createParticipant()->id;
        BidLimitPrice::create(['item_id' => $item->id, 'user_id' => $userId, 'limit_price' => 8000, 'is_triggered' => false]);
        BidParticipant::participate($item->id, $userId, true, null, 'auto-bid-from-limit');
        return [$item, $userId];
    }

    public function test_ライブ中に入札中の人が現在価格より低い指値に下げると拒否され入札は維持される(): void
    {
        Event::fake();
        [$item, $userId] = $this->makeLiveItemWithActiveLimitUser();

        $result = $this->action->execute($item, $userId, 200);

        $this->assertFalse($result->success);
        $this->assertSame('入札中は現在価格より低い上限価格に変更できません。', $result->message);
        $this->assertDatabaseHas('bid_limit_prices', ['item_id' => $item->id, 'user_id' => $userId, 'limit_price' => 8000, 'is_triggered' => false]);
        $this->assertDatabaseHas('bid_participants', ['item_id' => $item->id, 'user_id' => $userId, 'is_active' => true]);
        $this->assertDatabaseMissing('bid_events', ['item_id' => $item->id, 'user_id' => $userId, 'event_type' => 'leave']);
    }

    public function test_ライブ中に入札中の人が現在価格と同額の指値に変えるのは許可される(): void
    {
        Event::fake();
        [$item, $userId] = $this->makeLiveItemWithActiveLimitUser();

        $result = $this->action->execute($item, $userId, 210);

        $this->assertTrue($result->success);
        $this->assertDatabaseHas('bid_limit_prices', ['item_id' => $item->id, 'user_id' => $userId, 'limit_price' => 210]);
        $this->assertDatabaseHas('bid_participants', ['item_id' => $item->id, 'user_id' => $userId, 'is_active' => true]);
    }

    public function test_ライブ中に入札中の人が現在価格より高い指値に変えるのは許可される(): void
    {
        Event::fake();
        [$item, $userId] = $this->makeLiveItemWithActiveLimitUser();

        $result = $this->action->execute($item, $userId, 9000);

        $this->assertTrue($result->success);
        $this->assertDatabaseHas('bid_limit_prices', ['item_id' => $item->id, 'user_id' => $userId, 'limit_price' => 9000]);
        $this->assertDatabaseHas('bid_participants', ['item_id' => $item->id, 'user_id' => $userId, 'is_active' => true]);
    }

    public function test_ライブ中に入札中でない人が現在価格より低い指値を入れるのは従来どおり発動扱い(): void
    {
        Event::fake();
        $auction = Auction::factory()->create(['status' => 'live']);
        $item    = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live', 'current_price' => 210]);
        Lane::factory()->create(['auction_id' => $auction->id, 'current_item_id' => $item->id]);
        $userId = $this->createParticipant()->id;

        $result = $this->action->execute($item, $userId, 200);

        $this->assertTrue($result->success);
        // 即発動 → レコード削除（従来どおり）。入札参加はしない
        $this->assertDatabaseMissing('bid_limit_prices', ['item_id' => $item->id, 'user_id' => $userId]);
        $this->assertDatabaseMissing('bid_participants', ['item_id' => $item->id, 'user_id' => $userId, 'is_active' => true]);
    }

    public function test_開始前の商品には現在価格より低い指値でも保存される(): void
    {
        $auction = Auction::factory()->scheduled()->create();
        $item    = Item::factory()->registered()->create(['auction_id' => $auction->id, 'start_price' => 1000, 'current_price' => 1000]);
        $userId = $this->createParticipant()->id;

        $result = $this->action->execute($item, $userId, 500);

        $this->assertTrue($result->success);
        $this->assertDatabaseHas('bid_limit_prices', ['item_id' => $item->id, 'user_id' => $userId, 'limit_price' => 500, 'is_top_rank' => true]);
    }
}
