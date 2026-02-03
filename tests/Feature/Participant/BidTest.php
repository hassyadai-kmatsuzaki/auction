<?php

namespace Tests\Feature\Participant;

use App\Models\Auction;
use App\Models\Bid;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Models\User;
use Tests\TestCase;

class BidTest extends TestCase
{
    protected User $participant;
    protected User $admin;
    protected Auction $auction;
    protected Lane $lane;
    protected Item $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->participant = $this->createParticipant();
        $this->admin = $this->createAdmin();
        
        $this->auction = Auction::factory()->live()->create(['created_by' => $this->admin->id]);
        $this->lane = Lane::factory()->active()->create(['auction_id' => $this->auction->id]);
        
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        
        $this->item = Item::factory()->live()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $sellerProfile->id,
            'start_price' => 10000,
            'current_price' => 10000,
            'bid_increment' => 100,
        ]);

        $this->lane->update(['current_item_id' => $this->item->id]);
    }

    public function test_participant_can_place_bid(): void
    {
        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/bids', [
                'item_id' => $this->item->id,
                'lane_id' => $this->lane->id,
                'bid_amount' => 10100,
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('bids', [
            'item_id' => $this->item->id,
            'user_id' => $this->participant->id,
            'bid_amount' => 10100,
        ]);
    }

    public function test_bid_must_be_higher_than_current_price(): void
    {
        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/bids', [
                'item_id' => $this->item->id,
                'lane_id' => $this->lane->id,
                'bid_amount' => 9000, // 現在価格より低い
            ]);

        $response->assertStatus(422);
    }

    public function test_bid_must_follow_increment_rules(): void
    {
        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/bids', [
                'item_id' => $this->item->id,
                'lane_id' => $this->lane->id,
                'bid_amount' => 10050, // 入札単位に合わない
            ]);

        $response->assertStatus(422);
    }

    public function test_participant_can_view_own_active_bids(): void
    {
        Bid::factory()->create([
            'item_id' => $this->item->id,
            'lane_id' => $this->lane->id,
            'user_id' => $this->participant->id,
            'bid_amount' => 10100,
        ]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/participant/bids/my-active');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'bids',
                ],
            ]);
    }

    public function test_cannot_bid_on_non_live_item(): void
    {
        $item = Item::factory()->registered()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->item->seller_profile_id,
        ]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/bids', [
                'item_id' => $item->id,
                'lane_id' => $this->lane->id,
                'bid_amount' => 10100,
            ]);

        $response->assertStatus(422);
    }

    public function test_bid_requires_item_id(): void
    {
        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/bids', [
                'lane_id' => $this->lane->id,
                'bid_amount' => 10100,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['item_id']);
    }

    public function test_bid_requires_bid_amount(): void
    {
        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/bids', [
                'item_id' => $this->item->id,
                'lane_id' => $this->lane->id,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['bid_amount']);
    }

    public function test_non_participant_cannot_bid(): void
    {
        $seller = $this->createSeller();

        $response = $this->actingAs($seller, 'sanctum')
            ->postJson('/api/participant/bids', [
                'item_id' => $this->item->id,
                'lane_id' => $this->lane->id,
                'bid_amount' => 10100,
            ]);

        $response->assertStatus(403);
    }

    public function test_unauthenticated_user_cannot_bid(): void
    {
        $response = $this->postJson('/api/participant/bids', [
            'item_id' => $this->item->id,
            'lane_id' => $this->lane->id,
            'bid_amount' => 10100,
        ]);

        $response->assertStatus(401);
    }
}
