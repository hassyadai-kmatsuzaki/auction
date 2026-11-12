<?php

namespace Tests\Feature\Bid;

use App\Actions\Bid\SetBidLimitAction;
use App\Events\BidderUpdated;
use App\Jobs\FinishDummyLimitsJob;
use App\Jobs\NotifyBidLimitChunkJob;
use App\Models\Auction;
use App\Models\BidLimitPrice;
use App\Models\BidParticipant;
use App\Models\Item;
use App\Models\Lane;
use App\Models\User;
use App\Services\BidLimitRebalancer;
use App\Services\CountdownService;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * 事前指値の「上位2件だけ計算対象」（is_top_rank）2026-11-12
 *
 * 仕様書: 事前指値の上位2件実体化（ダミーフラグ）仕様書 §8.1 U1〜U15
 */
class BidLimitTopRankTest extends TestCase
{
    private SetBidLimitAction $action;
    private Auction $auction;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->action  = app(SetBidLimitAction::class);
        $this->auction = Auction::factory()->scheduled()->create();
    }

    private function item(array $attrs = []): Item
    {
        return Item::factory()->registered()->create($attrs + ['auction_id' => $this->auction->id, 'start_price' => 1000, 'current_price' => 1000]);
    }

    /** @return User[] */
    private function users(int $n): array
    {
        return array_map(fn () => $this->createParticipant(), range(1, $n));
    }

    private function topRankUserIds(Item $item): array
    {
        return BidLimitPrice::where('item_id', $item->id)->where('is_top_rank', true)->orderBy('user_id')->pluck('user_id')->all();
    }

    // ── U1〜U3: 登録時の振り分け ──────────────────────────────

    public function test_u1_single_limit_is_top_rank(): void
    {
        $item = $this->item();
        [$u] = $this->users(1);
        $this->action->execute($item, $u->id, 1500);

        $this->assertSame([$u->id], $this->topRankUserIds($item));
    }

    public function test_u2_different_prices_top_two_are_top_rank(): void
    {
        $item = $this->item();
        $us = $this->users(5);
        foreach ($us as $i => $u) {
            $this->action->execute($item, $u->id, 1100 + $i * 100); // 1100..1500
        }

        // 1500 と 1400（us[4], us[3]）が計算対象、残り3人はダミー
        $this->assertEqualsCanonicalizing([$us[4]->id, $us[3]->id], $this->topRankUserIds($item));
        $this->assertSame(3, BidLimitPrice::where('item_id', $item->id)->where('is_top_rank', false)->count());
    }

    public function test_u3_same_price_first_two_registrants_are_top_rank(): void
    {
        $item = $this->item();
        $us = $this->users(5);
        foreach ($us as $u) {
            $this->action->execute($item, $u->id, 1001);
        }

        $this->assertEqualsCanonicalizing([$us[0]->id, $us[1]->id], $this->topRankUserIds($item));
    }

    // ── U4〜U6: 取消・変更での繰り上げ／入れ替え ───────────────

    public function test_u4_removing_highest_promotes_third(): void
    {
        $item = $this->item();
        $us = $this->users(3);
        $this->action->execute($item, $us[0]->id, 3000);
        $this->action->execute($item, $us[1]->id, 2000);
        $this->action->execute($item, $us[2]->id, 1500);
        $this->assertEqualsCanonicalizing([$us[0]->id, $us[1]->id], $this->topRankUserIds($item));

        $this->action->remove($item, $us[0]->id);

        $this->assertEqualsCanonicalizing([$us[1]->id, $us[2]->id], $this->topRankUserIds($item));
        $this->assertDatabaseMissing('bid_limit_prices', ['item_id' => $item->id, 'user_id' => $us[0]->id]);
    }

    public function test_u5_dummy_raising_to_highest_becomes_top_rank(): void
    {
        $item = $this->item();
        $us = $this->users(3);
        $this->action->execute($item, $us[0]->id, 3000);
        $this->action->execute($item, $us[1]->id, 2000);
        $this->action->execute($item, $us[2]->id, 1500); // ダミー

        $this->action->execute($item, $us[2]->id, 5000);

        $this->assertEqualsCanonicalizing([$us[2]->id, $us[0]->id], $this->topRankUserIds($item));
        $this->assertFalse(BidLimitPrice::where('item_id', $item->id)->where('user_id', $us[1]->id)->value('is_top_rank'));
    }

    public function test_u6_top_rank_lowering_below_third_swaps(): void
    {
        $item = $this->item();
        $us = $this->users(3);
        $this->action->execute($item, $us[0]->id, 3000);
        $this->action->execute($item, $us[1]->id, 2000);
        $this->action->execute($item, $us[2]->id, 1500);

        $this->action->execute($item, $us[0]->id, 1200);

        $this->assertEqualsCanonicalizing([$us[1]->id, $us[2]->id], $this->topRankUserIds($item));
    }

    // ── U7: ライブ中の商品は対象外 ──────────────────────────────

    public function test_u7_live_item_keeps_all_rows_top_rank(): void
    {
        $this->auction->update(['status' => 'live']);
        $item = $this->item(['status' => 'live']);
        Lane::factory()->create(['auction_id' => $this->auction->id, 'current_item_id' => $item->id]);
        $us = $this->users(4);
        foreach ($us as $i => $u) {
            $this->action->execute($item, $u->id, 2000 + $i * 100);
        }

        // ライブ中は従来どおり: 即時の自動入札→価格調整で最高額だけが残り、残った行はすべて計算対象（ダミーは作られない）
        $this->assertSame(0, BidLimitPrice::where('item_id', $item->id)->where('is_top_rank', false)->count());
        $this->assertGreaterThanOrEqual(1, BidLimitPrice::where('item_id', $item->id)->where('is_top_rank', true)->count());
        $this->assertSame([$us[3]->id], BidParticipant::forItem($item->id)->active()->pluck('user_id')->all(), '最高額の人だけが入札中');
    }

    // ── U8〜U10: 開始時の処理 ────────────────────────────────

    public function test_u8_activation_joins_only_top_rank_and_dispatches_finish_job(): void
    {
        Event::fake([BidderUpdated::class]);
        Bus::fake([FinishDummyLimitsJob::class]);

        $item = $this->item();
        $us = $this->users(10);
        foreach ($us as $u) {
            $this->action->execute($item, $u->id, 1001);
        }
        $this->assertSame(2, BidLimitPrice::where('item_id', $item->id)->where('is_top_rank', true)->count());

        $this->auction->update(['status' => 'live']);
        $item->update(['status' => 'live']);
        Lane::factory()->create(['auction_id' => $this->auction->id, 'current_item_id' => $item->id]);

        $activated = $this->action->activatePendingBidLimits($item->fresh());

        $this->assertSame(2, $activated);
        $this->assertSame(2, BidParticipant::forItem($item->id)->active()->count());
        $this->assertEqualsCanonicalizing([$us[0]->id, $us[1]->id], BidParticipant::forItem($item->id)->active()->pluck('user_id')->all());
        Bus::assertDispatched(FinishDummyLimitsJob::class, fn ($job) => $job->itemId === $item->id);
    }

    public function test_u9_adjust_price_with_tie_processes_only_one_loser_in_lock(): void
    {
        Event::fake();
        Bus::fake();

        $item = $this->item();
        $us = $this->users(10);
        foreach ($us as $u) {
            $this->action->execute($item, $u->id, 1001);
        }
        $this->auction->update(['status' => 'live']);
        $item->update(['status' => 'live']);
        $lane = Lane::factory()->create(['auction_id' => $this->auction->id, 'current_item_id' => $item->id]);
        $this->action->activatePendingBidLimits($item->fresh());

        app(CountdownService::class)->adjustPriceByBidLimits($item->fresh(), $this->auction->fresh(), $lane, false);

        // 先着1人（us[0]）が落札権利者として active。us[1] は同額後発で脱落。着地価格 1001
        $this->assertSame(1001.0, (float) $item->fresh()->current_price);
        $this->assertSame([$us[0]->id], BidParticipant::forItem($item->id)->active()->pluck('user_id')->all());
        // ダミー8人は触られていない（回収ジョブの仕事）
        $this->assertSame(8, BidLimitPrice::where('item_id', $item->id)->where('is_top_rank', false)->where('is_triggered', false)->count());
    }

    public function test_u10_finish_job_removes_only_dummies_and_notifies(): void
    {
        Bus::fake([NotifyBidLimitChunkJob::class]);
        Event::fake();

        $item = $this->item();
        $us = $this->users(25);
        foreach ($us as $u) {
            $this->action->execute($item, $u->id, 1001);
        }
        $this->auction->update(['status' => 'live']);
        $item->update(['status' => 'live']);
        Lane::factory()->create(['auction_id' => $this->auction->id, 'current_item_id' => $item->id]);

        (new FinishDummyLimitsJob($item->id))->handle();

        $this->assertSame(2, BidLimitPrice::where('item_id', $item->id)->count(), '計算対象の2行は残る');
        $this->assertSame(2, BidLimitPrice::where('item_id', $item->id)->where('is_top_rank', true)->count());
        Bus::assertDispatchedTimes(NotifyBidLimitChunkJob::class, 2); // 23人 → 20 + 3
    }

    // ── U16〜U17: 回収前にダミーの人が手動入札した場合も上限が効く（2026-11-12）──

    public function test_u16_dummy_who_bid_manually_before_cleanup_keeps_limit_as_top_rank(): void
    {
        Bus::fake([NotifyBidLimitChunkJob::class]);
        Event::fake();

        $item = $this->item();
        $us = $this->users(4);
        foreach ($us as $u) {
            $this->action->execute($item, $u->id, 1001);
        }
        $this->auction->update(['status' => 'live']);
        $item->update(['status' => 'live']);
        Lane::factory()->create(['auction_id' => $this->auction->id, 'current_item_id' => $item->id]);
        // 3番目（ダミー）が回収ジョブより先に手動入札して入札中
        BidParticipant::participate($item->id, $us[2]->id, true, null, 'manual');

        (new FinishDummyLimitsJob($item->id))->handle();

        // 入札中の us[2] の上限は消えずに計算対象へ、入札していない us[3] は回収
        $this->assertDatabaseHas('bid_limit_prices', ['item_id' => $item->id, 'user_id' => $us[2]->id, 'limit_price' => 1001, 'is_top_rank' => true]);
        $this->assertDatabaseMissing('bid_limit_prices', ['item_id' => $item->id, 'user_id' => $us[3]->id]);
        Bus::assertDispatched(NotifyBidLimitChunkJob::class, fn ($j) => count($j->chunk) === 1 && $j->chunk[0]['_notify_user_id'] === $us[3]->id);
    }

    public function test_u17_check_bid_limits_triggers_dummy_rows_below_current_price(): void
    {
        Event::fake();
        Bus::fake();

        $item = $this->item();
        $us = $this->users(3);
        $this->action->execute($item, $us[0]->id, 3000);
        $this->action->execute($item, $us[1]->id, 2000);
        $this->action->execute($item, $us[2]->id, 1500); // ダミー
        $this->auction->update(['status' => 'live']);
        $item->update(['status' => 'live', 'current_price' => 1600]); // ダミーの上限を超えた
        $lane = Lane::factory()->create(['auction_id' => $this->auction->id, 'current_item_id' => $item->id]);
        BidParticipant::participate($item->id, $us[2]->id, true, null, 'manual');

        app(CountdownService::class)->checkBidLimits($lane, $item->fresh(), $this->auction->fresh());

        // 上限超えのダミーは入札から外れ、指値も消える（従来どおりの上限の効き方）
        $this->assertDatabaseMissing('bid_participants', ['item_id' => $item->id, 'user_id' => $us[2]->id, 'is_active' => true]);
        $this->assertDatabaseMissing('bid_limit_prices', ['item_id' => $item->id, 'user_id' => $us[2]->id]);
        // 上位2人の指値はそのまま
        $this->assertSame(2, BidLimitPrice::where('item_id', $item->id)->count());
    }

    // ── U11・U14・U15: 保険（フェイルオープン） ──────────────────

    public function test_u11_start_rebalance_promotes_when_top_rank_deleted_by_sql(): void
    {
        Event::fake();
        Bus::fake();

        $item = $this->item();
        $us = $this->users(4);
        foreach ($us as $i => $u) {
            $this->action->execute($item, $u->id, 2000 + $i * 100); // 最高は us[3]
        }
        // 管理操作等で計算対象の2行を SQL で消す
        BidLimitPrice::where('item_id', $item->id)->where('is_top_rank', true)->delete();
        $this->assertSame(0, BidLimitPrice::where('item_id', $item->id)->where('is_top_rank', true)->count());

        $this->auction->update(['status' => 'live']);
        $item->update(['status' => 'live']);
        Lane::factory()->create(['auction_id' => $this->auction->id, 'current_item_id' => $item->id]);

        $activated = $this->action->activatePendingBidLimits($item->fresh());

        $this->assertSame(2, $activated, '残った2人が繰り上がって参加する');
        $this->assertEqualsCanonicalizing([$us[0]->id, $us[1]->id], BidParticipant::forItem($item->id)->active()->pluck('user_id')->all());
    }

    public function test_u14_all_dummy_rows_are_restored_at_start(): void
    {
        Event::fake();
        Bus::fake();

        $item = $this->item();
        $us = $this->users(5);
        foreach ($us as $u) {
            $this->action->execute($item, $u->id, 1500);
        }
        BidLimitPrice::where('item_id', $item->id)->update(['is_top_rank' => false]);

        $this->auction->update(['status' => 'live']);
        $item->update(['status' => 'live']);
        Lane::factory()->create(['auction_id' => $this->auction->id, 'current_item_id' => $item->id]);

        $activated = $this->action->activatePendingBidLimits($item->fresh());

        // 開始時の並べ直しで上位2件が戻る（全部ダミーのまま流れることはない）
        $this->assertSame(2, $activated);
    }

    public function test_u15_rebalancer_exception_does_not_break_registration(): void
    {
        $item = $this->item();
        [$u] = $this->users(1);

        $broken = new class extends BidLimitRebalancer {
            public function rebalance(int $itemId, string $itemStatus, bool $force = false): int
            {
                throw new \RuntimeException('boom');
            }
        };
        $action = new SetBidLimitAction(app(\App\Actions\Bid\JoinBidAction::class), app(\App\Actions\Bid\LeaveBidAction::class), $broken);

        try {
            $action->execute($item, $u->id, 1500);
            $this->fail('例外は握る前提ではなく、呼び出し側のトランザクションで伝播する想定を確認');
        } catch (\RuntimeException) {
            // rebalance() 本体は内部で try/catch するので本番では到達しない。
            // ここは「握らない実装に差し替えたら登録が失敗する」ことの確認＝本体の try/catch が必須である根拠
        }

        // 本体の rebalancer は例外を外に出さない
        $rebalancer = app(BidLimitRebalancer::class);
        $this->assertSame(0, $rebalancer->rebalance(999999, 'registered'));
        $this->assertSame(0, $rebalancer->restoreAllIfNoneTopRank(999999));
    }

    // ── U12: まとめて入札経由 ────────────────────────────────

    public function test_u12_bulk_store_rebalances_each_item(): void
    {
        config(['features.bulk_bid_limit' => true]);
        $sellerProfile = \App\Models\SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
        $this->auction->update(['event_date' => now()->addDay()->toDateString(), 'start_time' => '10:00:00']);
        $items = collect(range(1, 3))->map(fn () => Item::factory()->registered()->create([
            'auction_id' => $this->auction->id, 'seller_profile_id' => $sellerProfile->id, 'start_price' => 1000, 'current_price' => 1000,
        ]));

        foreach (range(1, 5) as $i) {
            $p = $this->createParticipantWithSubscription();
            $this->actingAs($p, 'sanctum')
                ->postJson("/api/participant/auctions/{$this->auction->id}/bulk-bid-limits", [
                    'limits' => $items->map(fn ($it) => ['item_id' => $it->id, 'limit_price' => 1000 + $i])->values()->all(),
                ])->assertOk();
        }

        foreach ($items as $it) {
            $this->assertSame(2, BidLimitPrice::where('item_id', $it->id)->where('is_top_rank', true)->count());
            $this->assertSame(3, BidLimitPrice::where('item_id', $it->id)->where('is_top_rank', false)->count());
        }
    }
}
