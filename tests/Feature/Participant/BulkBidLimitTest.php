<?php

namespace Tests\Feature\Participant;

use App\Models\Auction;
use App\Models\BidLimitPrice;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\SpeciesType;
use App\Models\User;
use Tests\TestCase;

/**
 * スタート価格別の一括指値（BulkBidLimitController）
 */
class BulkBidLimitTest extends TestCase
{
    private User $participant;
    private Auction $auction;
    private SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        config(['features.bulk_bid_limit' => true]);
        $this->participant = $this->createParticipantWithSubscription();
        $admin = $this->createAdmin();
        $this->auction = Auction::factory()->scheduled()->create(['created_by' => $admin->id]);
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
    }

    private function makeItem(array $attrs = []): Item
    {
        return Item::factory()->registered()->create($attrs + [
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'start_price' => 1000,
        ]);
    }

    private function url(): string
    {
        return "/api/participant/auctions/{$this->auction->id}/bulk-bid-limits";
    }

    public function test_returns_404_when_switch_off(): void
    {
        config(['features.bulk_bid_limit' => false]);
        $this->actingAs($this->participant, 'sanctum')->getJson($this->url())->assertNotFound();
        $this->actingAs($this->participant, 'sanctum')
            ->postJson($this->url(), ['limits' => [['item_id' => 1, 'limit_price' => 1000]]])
            ->assertNotFound();
    }

    public function test_index_lists_only_registered_items_not_own(): void
    {
        $ok   = $this->makeItem();
        $this->makeItem(['status' => 'sold']);
        $this->makeItem(['status' => 'live']);
        $ownProfile = SellerProfile::factory()->create(['user_id' => $this->participant->id]);
        $this->makeItem(['seller_profile_id' => $ownProfile->id]);
        BidLimitPrice::create(['item_id' => $ok->id, 'user_id' => $this->participant->id, 'limit_price' => 3000]);

        $r = $this->actingAs($this->participant, 'sanctum')->getJson($this->url());
        $r->assertOk()->assertJsonPath('data.is_open', true);
        $this->assertSame([$ok->id], array_column($r->json('data.items'), 'id'));
        $this->assertSame(3000, $r->json('data.items.0.limit_price'));
        $this->assertGreaterThan(0, $r->json('data.items.0.unit'));
    }

    public function test_store_saves_all_limits(): void
    {
        $a = $this->makeItem();
        $b = $this->makeItem();
        $unit = $this->auction->calculatePriceIncrement(1000);

        $this->actingAs($this->participant, 'sanctum')
            ->postJson($this->url(), ['limits' => [
                ['item_id' => $a->id, 'limit_price' => 1000],
                ['item_id' => $b->id, 'limit_price' => 1000 + $unit * 2],
            ]])
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('bid_limit_prices', ['item_id' => $a->id, 'user_id' => $this->participant->id, 'limit_price' => 1000]);
        $this->assertDatabaseHas('bid_limit_prices', ['item_id' => $b->id, 'user_id' => $this->participant->id, 'limit_price' => 1000 + $unit * 2]);
        // 一括はお気に入りに自動登録しない（個別の上限設定は従来どおり登録する）
        $this->assertDatabaseMissing('favorites', ['item_id' => $a->id, 'user_id' => $this->participant->id]);
        $this->assertDatabaseMissing('favorites', ['item_id' => $b->id, 'user_id' => $this->participant->id]);
    }

    public function test_individual_limit_still_auto_favorites(): void
    {
        $a = $this->makeItem();
        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/bid-limits', ['item_id' => $a->id, 'limit_price' => 1000])
            ->assertOk();
        $this->assertDatabaseHas('favorites', ['item_id' => $a->id, 'user_id' => $this->participant->id]);
    }

    public function test_store_saves_nothing_when_one_is_invalid(): void
    {
        $a = $this->makeItem();
        $b = $this->makeItem();

        $r = $this->actingAs($this->participant, 'sanctum')
            ->postJson($this->url(), ['limits' => [
                ['item_id' => $a->id, 'limit_price' => 2000],
                ['item_id' => $b->id, 'limit_price' => 500], // スタート価格未満
            ]]);
        $r->assertStatus(422);
        $this->assertSame($b->id, $r->json('data.errors.0.item_id'));
        $this->assertDatabaseCount('bid_limit_prices', 0);
    }

    public function test_store_accepts_any_yen_at_or_above_start_price(): void
    {
        $a = $this->makeItem(['start_price' => 1000]);
        $b = $this->makeItem(['start_price' => 950]);
        $c = $this->makeItem(['start_price' => 1000]);

        // 個別の上限設定と同じく 1円単位で受け付ける（¥1,001 / ¥1,050）。開始価格未満（¥999）だけ拒否
        $this->actingAs($this->participant, 'sanctum')
            ->postJson($this->url(), ['limits' => [
                ['item_id' => $a->id, 'limit_price' => 1001],
                ['item_id' => $b->id, 'limit_price' => 1050],
            ]])
            ->assertOk();
        $this->assertDatabaseHas('bid_limit_prices', ['item_id' => $a->id, 'limit_price' => 1001]);
        $this->actingAs($this->participant, 'sanctum')
            ->postJson($this->url(), ['limits' => [['item_id' => $c->id, 'limit_price' => 999]]])
            ->assertStatus(422);
        $this->assertDatabaseMissing('bid_limit_prices', ['item_id' => $c->id]);
    }

    public function test_index_returns_increment_tiers_of_the_auction(): void
    {
        $this->auction->update([
            'use_custom_settings'     => true,
            'custom_auction_settings' => ['price_increment_tiers' => [
                ['from_price' => 1000, 'to_price' => null, 'increment_amount' => 100],
                ['from_price' => 0,    'to_price' => 999,  'increment_amount' => 50],
            ]],
        ]);
        $this->makeItem();

        $r = $this->actingAs($this->participant, 'sanctum')->getJson($this->url());
        $r->assertOk();
        // from_price 昇順・to_price null は上限なし
        $this->assertSame([0, 1000], array_column($r->json('data.increment_tiers'), 'from_price'));
        $this->assertSame([50, 100], array_column($r->json('data.increment_tiers'), 'increment_amount'));
        $this->assertNull($r->json('data.increment_tiers.1.to_price'));
        $this->assertSame(100, $r->json('data.items.0.unit'));
    }

    public function test_store_rejects_live_and_own_items(): void
    {
        $live = $this->makeItem(['status' => 'live']);
        $ownProfile = SellerProfile::factory()->create(['user_id' => $this->participant->id]);
        $own = $this->makeItem(['seller_profile_id' => $ownProfile->id]);

        $this->actingAs($this->participant, 'sanctum')
            ->postJson($this->url(), ['limits' => [
                ['item_id' => $live->id, 'limit_price' => 1000],
                ['item_id' => $own->id, 'limit_price' => 1000],
            ]])
            ->assertStatus(422);
        $this->assertDatabaseCount('bid_limit_prices', 0);
    }

    public function test_other_species_is_flagged_and_rejected(): void
    {
        $otherTypeId = SpeciesType::where('code', 'other')->value('id');
        $medaka = $this->makeItem();
        $goldfish = $this->makeItem(['species_type_id' => $otherTypeId]);

        $r = $this->actingAs($this->participant, 'sanctum')->getJson($this->url());
        $flags = collect($r->json('data.items'))->pluck('is_other', 'id');
        $this->assertFalse($flags[$medaka->id]);
        $this->assertTrue($flags[$goldfish->id]);

        $this->actingAs($this->participant, 'sanctum')
            ->postJson($this->url(), ['limits' => [['item_id' => $goldfish->id, 'limit_price' => 1000]]])
            ->assertStatus(422);
        $this->assertDatabaseCount('bid_limit_prices', 0);
    }

    public function test_store_rejects_after_auction_started(): void
    {
        $a = $this->makeItem();
        $this->auction->update(['status' => 'live']);

        $this->actingAs($this->participant, 'sanctum')
            ->postJson($this->url(), ['limits' => [['item_id' => $a->id, 'limit_price' => 1000]]])
            ->assertStatus(422)
            ->assertJsonPath('message', '事前入札の受付は終了しました。');
        $this->assertDatabaseCount('bid_limit_prices', 0);
    }

    /** 受付は開始の5分前まで。4分前は 422、6分前は受け付ける（個別の上限設定は対象外） */
    public function test_store_closes_five_minutes_before_start(): void
    {
        $a = $this->makeItem();
        $this->auction->update(['event_date' => now()->addMinutes(4)->toDateString(), 'start_time' => now()->addMinutes(4)->format('H:i:s')]);

        $this->actingAs($this->participant, 'sanctum')
            ->getJson($this->url())
            ->assertOk()
            ->assertJsonPath('data.is_open', false)
            ->assertJsonPath('data.close_minutes', 5);
        $this->actingAs($this->participant, 'sanctum')
            ->postJson($this->url(), ['limits' => [['item_id' => $a->id, 'limit_price' => 1000]]])
            ->assertStatus(422)
            ->assertJsonPath('message', 'まとめて事前入札の受付はオークション開始5分前に終了しました。1点ずつの上限設定は開始までできます。');
        $this->assertDatabaseCount('bid_limit_prices', 0);

        $this->auction->update(['event_date' => now()->addMinutes(6)->toDateString(), 'start_time' => now()->addMinutes(6)->format('H:i:s')]);
        $this->actingAs($this->participant, 'sanctum')
            ->getJson($this->url())
            ->assertOk()
            ->assertJsonPath('data.is_open', true);
        $this->actingAs($this->participant, 'sanctum')
            ->postJson($this->url(), ['limits' => [['item_id' => $a->id, 'limit_price' => 1000]]])
            ->assertOk();
        $this->assertDatabaseCount('bid_limit_prices', 1);
    }
}
