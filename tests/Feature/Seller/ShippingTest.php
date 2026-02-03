<?php

namespace Tests\Feature\Seller;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

class ShippingTest extends TestCase
{
    protected User $seller;
    protected User $admin;
    protected SellerProfile $sellerProfile;
    protected Item $item;
    protected WonItem $wonItem;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $this->seller->id]);
        $this->admin = $this->createAdmin();

        $auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        $this->item = Item::factory()->sold()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $winner = $this->createParticipant();
        $this->wonItem = WonItem::factory()->confirmed()->create([
            'item_id' => $this->item->id,
            'winner_id' => $winner->id,
        ]);
    }

    public function test_seller_can_list_shipping_items(): void
    {
        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson('/api/seller/shipping');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'items',
                ],
            ]);
    }

    public function test_seller_can_view_shipping_detail(): void
    {
        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson("/api/seller/shipping/{$this->wonItem->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'won_item',
                ],
            ]);
    }

    public function test_seller_can_register_shipping(): void
    {
        $response = $this->actingAs($this->seller, 'sanctum')
            ->postJson("/api/seller/shipping/{$this->wonItem->id}", [
                'shipping_company' => 'ヤマト運輸',
                'tracking_number' => '1234-5678-9012',
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('won_items', [
            'id' => $this->wonItem->id,
            'delivery_status' => 'shipped',
            'tracking_number' => '1234-5678-9012',
        ]);
    }

    public function test_shipping_requires_company_and_tracking_number(): void
    {
        $response = $this->actingAs($this->seller, 'sanctum')
            ->postJson("/api/seller/shipping/{$this->wonItem->id}", []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['shipping_company', 'tracking_number']);
    }

    public function test_seller_cannot_ship_other_sellers_item(): void
    {
        $otherSeller = $this->createSeller();
        $otherProfile = SellerProfile::factory()->create(['user_id' => $otherSeller->id]);

        $auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        $item = Item::factory()->sold()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $otherProfile->id,
        ]);

        $winner = $this->createParticipant();
        $wonItem = WonItem::factory()->confirmed()->create([
            'item_id' => $item->id,
            'winner_id' => $winner->id,
        ]);

        $response = $this->actingAs($this->seller, 'sanctum')
            ->postJson("/api/seller/shipping/{$wonItem->id}", [
                'shipping_company' => 'ヤマト運輸',
                'tracking_number' => '1234-5678-9012',
            ]);

        $response->assertStatus(403);
    }

    public function test_non_seller_cannot_access_shipping(): void
    {
        $participant = $this->createParticipant();

        $response = $this->actingAs($participant, 'sanctum')
            ->getJson('/api/seller/shipping');

        $response->assertStatus(403);
    }
}
