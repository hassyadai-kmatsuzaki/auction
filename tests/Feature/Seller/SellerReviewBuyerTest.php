<?php

namespace Tests\Feature\Seller;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

/**
 * F-023 出品者から落札者への評価（表示スイッチ OFF が既定）
 */
class SellerReviewBuyerTest extends TestCase
{
    private User $seller;
    private User $buyer;
    private WonItem $wonItem;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->seller = $this->createSeller();
        $this->buyer = $this->createParticipant();
        $profile = SellerProfile::factory()->create(['user_id' => $this->seller->id]);
        $item = Item::factory()->create(['auction_id' => Auction::factory()->finished()->create()->id, 'seller_profile_id' => $profile->id, 'status' => 'sold']);
        $this->wonItem = WonItem::factory()->create(['item_id' => $item->id, 'winner_id' => $this->buyer->id, 'payment_status' => 'paid']);
    }

    public function test_seller_can_review_buyer_once_and_buyer_score_is_updated(): void
    {
        config(['features.seller_review_buyer' => true]);

        $this->actingAs($this->seller, 'sanctum')
            ->postJson('/api/seller/reviews', ['won_item_id' => $this->wonItem->id, 'rating' => 4])
            ->assertStatus(201);
        $this->assertDatabaseHas('user_reviews', ['won_item_id' => $this->wonItem->id, 'role' => 'seller', 'reviewee_id' => $this->buyer->id, 'rating' => 4]);
        $this->assertSame(1, (int) $this->buyer->fresh()->review_count);

        $this->actingAs($this->seller, 'sanctum')
            ->postJson('/api/seller/reviews', ['won_item_id' => $this->wonItem->id, 'rating' => 5])
            ->assertStatus(422);

        $this->actingAs($this->seller, 'sanctum')
            ->getJson("/api/seller/items/{$this->wonItem->item_id}")
            ->assertOk()
            ->assertJsonPath('data.item.won_item.seller_reviewed', true);
    }

    public function test_other_seller_cannot_review(): void
    {
        config(['features.seller_review_buyer' => true]);
        $other = $this->createSeller();

        $this->actingAs($other, 'sanctum')
            ->postJson('/api/seller/reviews', ['won_item_id' => $this->wonItem->id, 'rating' => 1])
            ->assertStatus(403);
    }

    public function test_closed_and_hidden_when_feature_off(): void
    {
        $this->actingAs($this->seller, 'sanctum')
            ->postJson('/api/seller/reviews', ['won_item_id' => $this->wonItem->id, 'rating' => 4])
            ->assertStatus(404);

        $this->actingAs($this->seller, 'sanctum')
            ->getJson("/api/seller/items/{$this->wonItem->item_id}")
            ->assertOk()
            ->assertJsonMissingPath('data.item.won_item.seller_reviewed');
    }
}
