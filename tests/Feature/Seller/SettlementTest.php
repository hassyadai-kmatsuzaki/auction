<?php

namespace Tests\Feature\Seller;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

class SettlementTest extends TestCase
{
    protected User $seller;
    protected User $admin;
    protected SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $this->seller->id]);
        $this->admin = $this->createAdmin();
    }

    public function test_seller_can_view_settlement_summary(): void
    {
        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson('/api/seller/settlements');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data',
            ]);
    }

    public function test_seller_can_view_settlement_detail(): void
    {
        $auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        
        $item = Item::factory()->sold()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $winner = $this->createParticipant();
        WonItem::factory()->confirmed()->create([
            'item_id' => $item->id,
            'winner_id' => $winner->id,
        ]);

        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson("/api/seller/settlements/{$auction->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data',
            ]);
    }

    public function test_seller_settlement_shows_correct_amounts(): void
    {
        $auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        
        $item = Item::factory()->sold()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'start_price' => 30000,
        ]);

        $winner = $this->createParticipant();
        WonItem::factory()->confirmed()->create([
            'item_id' => $item->id,
            'winner_id' => $winner->id,
            'winning_price' => 35000,
            'seller_amount' => 31500, // 35000 - 10%
        ]);

        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson("/api/seller/settlements/{$auction->id}");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_non_seller_cannot_access_settlements(): void
    {
        $participant = $this->createParticipant();

        $response = $this->actingAs($participant, 'sanctum')
            ->getJson('/api/seller/settlements');

        $response->assertStatus(403);
    }

    public function test_seller_cannot_view_other_sellers_settlement(): void
    {
        $otherSeller = $this->createSeller();
        $otherProfile = SellerProfile::factory()->create(['user_id' => $otherSeller->id]);

        $auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        
        $item = Item::factory()->sold()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $otherProfile->id,
        ]);

        $winner = $this->createParticipant();
        WonItem::factory()->create([
            'item_id' => $item->id,
            'winner_id' => $winner->id,
        ]);

        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson("/api/seller/settlements/{$auction->id}");

        // Returns 404 because no won_items for this seller in this auction
        $response->assertStatus(404);
    }
}
