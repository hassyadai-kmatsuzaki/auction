<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Role;
use App\Models\Item;
use App\Models\Auction;
use App\Models\WonItem;
use App\Models\SellerProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReviewTest extends TestCase
{
    use RefreshDatabase;

    private User $buyer;
    private User $seller;
    private WonItem $wonItem;

    protected function setUp(): void
    {
        parent::setUp();

        $participantRole = Role::firstOrCreate(['name' => 'participant', 'display_name' => '参加者']);
        $sellerRole = Role::firstOrCreate(['name' => 'seller', 'display_name' => '出品者']);

        $this->buyer = User::factory()->create(['status' => 'approved', 'is_active' => true]);
        $this->buyer->roles()->attach($participantRole);

        $this->seller = User::factory()->create(['status' => 'approved', 'is_active' => true]);
        $this->seller->roles()->attach($sellerRole);

        $sellerProfile = SellerProfile::factory()->create(['user_id' => $this->seller->id]);

        $auction = Auction::factory()->create();
        $item = Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);

        $this->wonItem = WonItem::factory()->create([
            'item_id' => $item->id,
            'winner_id' => $this->buyer->id,
            'payment_status' => 'paid',
        ]);
    }

    public function test_buyer_can_submit_review(): void
    {
        $response = $this->actingAs($this->buyer)
            ->postJson('/api/participant/reviews', [
                'won_item_id' => $this->wonItem->id,
                'rating' => 5,
                'comment' => '素晴らしいメダカでした！',
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('user_reviews', [
            'reviewer_id' => $this->buyer->id,
            'won_item_id' => $this->wonItem->id,
            'rating' => 5,
        ]);
    }

    public function test_cannot_review_twice(): void
    {
        $this->actingAs($this->buyer)
            ->postJson('/api/participant/reviews', [
                'won_item_id' => $this->wonItem->id,
                'rating' => 4,
            ]);

        $response = $this->actingAs($this->buyer)
            ->postJson('/api/participant/reviews', [
                'won_item_id' => $this->wonItem->id,
                'rating' => 5,
            ]);

        $response->assertStatus(422);
    }

    public function test_rating_must_be_between_1_and_5(): void
    {
        $response = $this->actingAs($this->buyer)
            ->postJson('/api/participant/reviews', [
                'won_item_id' => $this->wonItem->id,
                'rating' => 6,
            ]);

        $response->assertStatus(422);
    }

    public function test_review_summary(): void
    {
        $response = $this->actingAs($this->buyer)
            ->getJson("/api/participant/reviews/user/{$this->seller->id}");

        $response->assertOk()
            ->assertJsonStructure([
                'data' => ['total', 'average', 'positive', 'neutral', 'negative'],
            ]);
    }
}
