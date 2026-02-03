<?php

namespace Tests\Feature\Participant;

use App\Models\Auction;
use App\Models\BidParticipant;
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

    public function test_participant_can_join_bid(): void
    {
        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/bids', [
                'item_id' => $this->item->id,
                'is_active' => true,
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('bid_participants', [
            'item_id' => $this->item->id,
            'user_id' => $this->participant->id,
            'is_active' => true,
        ]);
    }

    public function test_participant_can_leave_bid(): void
    {
        // First join
        BidParticipant::create([
            'item_id' => $this->item->id,
            'user_id' => $this->participant->id,
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/bids', [
                'item_id' => $this->item->id,
                'is_active' => false,
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('bid_participants', [
            'item_id' => $this->item->id,
            'user_id' => $this->participant->id,
            'is_active' => false,
        ]);
    }

    public function test_participant_can_view_own_active_bids(): void
    {
        BidParticipant::create([
            'item_id' => $this->item->id,
            'user_id' => $this->participant->id,
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/participant/bids/my-active');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'active_bids',
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
                'is_active' => true,
            ]);

        $response->assertStatus(400);
    }

    public function test_bid_requires_item_id(): void
    {
        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/bids', [
                'is_active' => true,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['item_id']);
    }

    public function test_bid_requires_is_active(): void
    {
        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/bids', [
                'item_id' => $this->item->id,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['is_active']);
    }

    public function test_non_participant_cannot_bid(): void
    {
        $seller = $this->createSeller();

        $response = $this->actingAs($seller, 'sanctum')
            ->postJson('/api/participant/bids', [
                'item_id' => $this->item->id,
                'is_active' => true,
            ]);

        $response->assertStatus(403);
    }

    public function test_unauthenticated_user_cannot_bid(): void
    {
        $response = $this->postJson('/api/participant/bids', [
            'item_id' => $this->item->id,
            'is_active' => true,
        ]);

        $response->assertStatus(401);
    }
}
