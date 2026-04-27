<?php

namespace Tests\Feature\Participant;

use App\Models\Auction;
use App\Models\BidLimitPrice;
use App\Models\Favorite;
use App\Models\Item;
use App\Models\LineAccount;
use App\Models\LineNotificationSetting;
use App\Models\SavedSearch;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\UserReview;
use App\Models\WonItem;
use App\Services\LineService;
use Mockery;
use Tests\TestCase;

/**
 * 参加者向け補助機能（Favorite / SavedSearch / BidLimit / LineSettings / Review）のテスト。
 */
class ParticipantFeaturesTest extends TestCase
{
    private User $participant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->participant = $this->createParticipantWithSubscription();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function makeItem(): Item
    {
        $admin = $this->createAdmin();
        $auction = Auction::factory()->scheduled()->create(['created_by' => $admin->id]);
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        return Item::factory()->live()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);
    }

    // ========== Favorite ==========

    public function test_favorite_index_returns_user_favorites(): void
    {
        $item = $this->makeItem();
        Favorite::create(['user_id' => $this->participant->id, 'item_id' => $item->id]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/participant/favorites');

        $response->assertOk()
            ->assertJsonStructure(['data' => ['favorites']]);
    }

    public function test_favorite_toggle_adds_and_removes(): void
    {
        $item = $this->makeItem();

        // 追加
        $r1 = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/favorites/toggle', ['item_id' => $item->id]);
        $r1->assertOk()->assertJsonPath('is_favorited', true);
        $this->assertDatabaseHas('favorites', ['user_id' => $this->participant->id, 'item_id' => $item->id]);

        // 解除
        $r2 = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/favorites/toggle', ['item_id' => $item->id]);
        $r2->assertOk()->assertJsonPath('is_favorited', false);
        $this->assertDatabaseMissing('favorites', ['user_id' => $this->participant->id, 'item_id' => $item->id]);
    }

    public function test_favorite_toggle_validates_item_exists(): void
    {
        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/favorites/toggle', ['item_id' => 999999])
            ->assertStatus(422);
    }

    public function test_favorite_check_bulk(): void
    {
        $item1 = $this->makeItem();
        $item2 = $this->makeItem();
        Favorite::create(['user_id' => $this->participant->id, 'item_id' => $item1->id]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/favorites/check', [
                'item_ids' => [$item1->id, $item2->id],
            ]);

        $response->assertOk();
        $favIds = $response->json('data.favorite_item_ids');
        $this->assertContains($item1->id, $favIds);
        $this->assertNotContains($item2->id, $favIds);
    }

    // ========== SavedSearch ==========

    public function test_saved_search_index_and_store(): void
    {
        $r = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/saved-searches', [
                'name' => 'メダカ高級',
                'conditions' => ['species' => 'メダカ', 'min_price' => 5000],
                'notify_on_match' => true,
            ]);
        $r->assertCreated();

        $list = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/participant/saved-searches');
        $list->assertOk();
        $this->assertNotEmpty($list->json('data'));
    }

    public function test_saved_search_destroy(): void
    {
        $search = SavedSearch::create([
            'user_id' => $this->participant->id,
            'name' => 'test',
            'conditions' => ['x' => 'y'],
            'notify_on_match' => false,
        ]);

        $this->actingAs($this->participant, 'sanctum')
            ->deleteJson("/api/participant/saved-searches/{$search->id}")
            ->assertOk();
        $this->assertDatabaseMissing('saved_searches', ['id' => $search->id]);
    }

    public function test_saved_search_caps_at_20(): void
    {
        for ($i = 0; $i < 20; $i++) {
            SavedSearch::create([
                'user_id' => $this->participant->id,
                'name' => "search-$i",
                'conditions' => ['x' => $i],
                'notify_on_match' => false,
            ]);
        }

        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/saved-searches', [
                'name' => 'overflow',
                'conditions' => ['x' => 'y'],
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', '保存できる検索条件は20件までです');
    }

    public function test_saved_search_other_user_cannot_delete(): void
    {
        $other = $this->createParticipant();
        $search = SavedSearch::create([
            'user_id' => $other->id,
            'name' => 'other',
            'conditions' => ['x' => 'y'],
            'notify_on_match' => false,
        ]);
        $this->actingAs($this->participant, 'sanctum')
            ->deleteJson("/api/participant/saved-searches/{$search->id}")
            ->assertStatus(404);
    }

    // ========== BidLimit ==========

    public function test_bid_limit_index_returns_limits_keyed_by_item(): void
    {
        $item = $this->makeItem();
        BidLimitPrice::create([
            'item_id' => $item->id,
            'user_id' => $this->participant->id,
            'limit_price' => 10000,
        ]);

        $r = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/participant/bid-limits?item_ids[]=' . $item->id);
        $r->assertOk();
        $this->assertSame(10000, (int) $r->json("data.limits.{$item->id}.limit_price"));
    }

    public function test_bid_limit_index_validates(): void
    {
        $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/participant/bid-limits')
            ->assertStatus(422);
    }

    public function test_bid_limit_show_returns_quick_options(): void
    {
        $item = $this->makeItem();
        $r = $this->actingAs($this->participant, 'sanctum')
            ->getJson("/api/participant/bid-limits/{$item->id}");
        $r->assertOk()
            ->assertJsonStructure(['data' => ['quick_options' => ['base_price', 'x1_5', 'x2', 'x2_5', 'x3']]]);
    }

    // ========== LineSettings ==========

    public function test_line_notification_settings_index(): void
    {
        $r = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/line/settings/notifications');
        $r->assertOk()
            ->assertJsonStructure(['data' => ['notifications' => [['type', 'label', 'is_enabled']]]]);
    }

    public function test_line_notification_settings_update_persists(): void
    {
        $r = $this->actingAs($this->participant, 'sanctum')
            ->putJson('/api/line/settings/notifications', [
                'settings' => [
                    ['type' => 'won_item', 'is_enabled' => false],
                    ['type' => 'shipping_completed', 'is_enabled' => true],
                ],
            ]);
        $r->assertOk();
        $this->assertDatabaseHas('line_notification_settings', [
            'user_id' => $this->participant->id,
            'notification_type' => 'won_item',
            'is_enabled' => false,
        ]);
    }

    public function test_line_notification_test_requires_linked_account(): void
    {
        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/line/settings/test', ['type' => 'won_item'])
            ->assertStatus(400);
    }

    public function test_line_notification_test_sends_message_when_linked(): void
    {
        LineAccount::create([
            'user_id' => $this->participant->id,
            'line_user_id' => 'U_LINE_OK',
            'is_active' => true,
            'linked_at' => now(),
        ]);

        $this->mock(LineService::class, function ($m) {
            $m->shouldReceive('pushFlex')->andReturn(true);
            $m->shouldReceive('pushText')->andReturn(true);
        });

        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/line/settings/test', ['type' => 'won_item'])
            ->assertOk();
    }

    // ========== Review ==========

    public function test_review_received_returns_paginated_list(): void
    {
        $r = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/participant/reviews/received');
        $r->assertOk()->assertJsonStructure(['data' => ['data', 'total']]);
    }

    public function test_review_summary_returns_aggregates(): void
    {
        $r = $this->actingAs($this->participant, 'sanctum')
            ->getJson("/api/participant/reviews/user/{$this->participant->id}");
        $r->assertOk()
            ->assertJsonStructure(['data' => ['total', 'average', 'positive', 'neutral', 'negative', 'recent_reviews']]);
    }

    public function test_review_store_requires_paid_status(): void
    {
        $item = $this->makeItem();
        $wonItem = WonItem::factory()->create([
            'item_id' => $item->id,
            'winner_id' => $this->participant->id,
            'payment_status' => 'pending',
        ]);

        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/reviews', [
                'won_item_id' => $wonItem->id,
                'rating' => 5,
                'comment' => '良い取引でした',
            ])
            ->assertStatus(422);
    }

    public function test_review_store_blocks_unrelated_user(): void
    {
        $item = $this->makeItem();
        $other = $this->createParticipant();
        $wonItem = WonItem::factory()->paid()->create([
            'item_id' => $item->id,
            'winner_id' => $other->id,
        ]);

        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/reviews', [
                'won_item_id' => $wonItem->id,
                'rating' => 5,
            ])
            ->assertStatus(403);
    }

    public function test_review_store_creates_when_paid_buyer(): void
    {
        $item = $this->makeItem();
        $wonItem = WonItem::factory()->paid()->create([
            'item_id' => $item->id,
            'winner_id' => $this->participant->id,
        ]);

        $r = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/reviews', [
                'won_item_id' => $wonItem->id,
                'rating' => 4,
                'comment' => '良かった',
            ]);
        $r->assertCreated();
        $this->assertDatabaseHas('user_reviews', [
            'reviewer_id' => $this->participant->id,
            'won_item_id' => $wonItem->id,
            'role' => 'buyer',
            'rating' => 4,
        ]);
    }

    public function test_review_store_blocks_duplicate(): void
    {
        $item = $this->makeItem();
        $wonItem = WonItem::factory()->paid()->create([
            'item_id' => $item->id,
            'winner_id' => $this->participant->id,
        ]);

        // 1 回目
        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/reviews', [
                'won_item_id' => $wonItem->id,
                'rating' => 5,
            ])->assertCreated();

        // 2 回目は重複でNG
        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/reviews', [
                'won_item_id' => $wonItem->id,
                'rating' => 5,
            ])->assertStatus(422);
    }
}
