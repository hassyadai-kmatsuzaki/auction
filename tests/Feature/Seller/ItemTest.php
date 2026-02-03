<?php

namespace Tests\Feature\Seller;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use Tests\TestCase;

class ItemTest extends TestCase
{
    protected User $seller;
    protected User $admin;
    protected SellerProfile $sellerProfile;
    protected Auction $auction;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $this->seller->id]);
        $this->admin = $this->createAdmin();
        $this->auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
    }

    public function test_seller_can_list_own_items(): void
    {
        Item::factory()->count(3)->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson('/api/seller/items');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'items',
                ],
            ]);
    }

    public function test_seller_can_create_item(): void
    {
        $response = $this->actingAs($this->seller, 'sanctum')
            ->postJson('/api/seller/items', [
                'auction_id' => $this->auction->id,
                'species_name' => 'ボールパイソン アルビノ',
                'quantity' => 1,
                'start_price' => 30000,
                'individual_info' => '性別：オス',
            ]);

        $response->assertStatus(201)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('items', [
            'species_name' => 'ボールパイソン アルビノ',
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
    }

    public function test_seller_can_view_own_item_detail(): void
    {
        $item = Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson("/api/seller/items/{$item->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'item',
                ],
            ]);
    }

    public function test_seller_cannot_view_other_sellers_item(): void
    {
        $otherSeller = $this->createSeller();
        $otherProfile = SellerProfile::factory()->create(['user_id' => $otherSeller->id]);
        
        $item = Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $otherProfile->id,
        ]);

        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson("/api/seller/items/{$item->id}");

        // Query filters by seller_profile_id, so returns 404 (not found)
        $response->assertStatus(404);
    }

    public function test_seller_can_update_own_item(): void
    {
        $item = Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->seller, 'sanctum')
            ->putJson("/api/seller/items/{$item->id}", [
                'species_name' => '更新された品種名',
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('items', [
            'id' => $item->id,
            'species_name' => '更新された品種名',
        ]);
    }

    public function test_seller_cannot_update_sold_item(): void
    {
        $item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->seller, 'sanctum')
            ->putJson("/api/seller/items/{$item->id}", [
                'species_name' => '更新された品種名',
            ]);

        $response->assertStatus(422);
    }

    public function test_seller_can_delete_draft_item(): void
    {
        $item = Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->seller, 'sanctum')
            ->deleteJson("/api/seller/items/{$item->id}");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        // destroy sets status to 'cancelled' instead of deleting
        $this->assertDatabaseHas('items', [
            'id' => $item->id,
            'status' => 'cancelled',
        ]);
    }

    public function test_item_creation_requires_auction_id(): void
    {
        $response = $this->actingAs($this->seller, 'sanctum')
            ->postJson('/api/seller/items', [
                'species_name' => 'テスト品種',
                'quantity' => 1,
                'start_price' => 30000,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['auction_id']);
    }

    public function test_non_seller_cannot_create_items(): void
    {
        $participant = $this->createParticipant();

        $response = $this->actingAs($participant, 'sanctum')
            ->postJson('/api/seller/items', [
                'auction_id' => $this->auction->id,
                'species_name' => 'テスト品種',
                'quantity' => 1,
                'start_price' => 30000,
            ]);

        $response->assertStatus(403);
    }

    public function test_seller_can_get_item_stats(): void
    {
        // 複数のステータスのアイテムを作成
        Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'status' => 'pending',
        ]);
        Item::factory()->registered()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson('/api/seller/items/stats');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data',
            ]);
    }

    public function test_seller_can_get_available_auctions(): void
    {
        // 出品可能なオークションを作成
        Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);

        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson('/api/seller/items/auctions');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'auctions',
                ],
            ]);
    }
}
