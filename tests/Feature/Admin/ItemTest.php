<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use Tests\TestCase;

class ItemTest extends TestCase
{
    protected User $admin;
    protected Auction $auction;
    protected SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->auction = Auction::factory()->create(['created_by' => $this->admin->id]);
        
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
    }

    public function test_admin_can_list_items(): void
    {
        Item::factory()->count(5)->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/auctions/{$this->auction->id}/items");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'auction',
                    'items',
                    'pagination',
                ],
            ]);
    }

    public function test_admin_can_create_item(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/items", [
                'species_name' => 'ボールパイソン アルビノ',
                'quantity' => 1,
                'start_price' => 30000,
                'seller_profile_id' => $this->sellerProfile->id,
            ]);

        $response->assertStatus(201)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('items', [
            'auction_id' => $this->auction->id,
            'species_name' => 'ボールパイソン アルビノ',
        ]);
    }

    public function test_admin_can_view_item_detail(): void
    {
        $item = Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'item' => ['id', 'species_name', 'start_price', 'status'],
                ],
            ]);
    }

    public function test_admin_can_update_item(): void
    {
        $item = Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}", [
                'species_name' => '更新された品種名',
                'start_price' => 50000,
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('items', [
            'id' => $item->id,
            'species_name' => '更新された品種名',
        ]);
    }

    public function test_admin_cannot_update_sold_item(): void
    {
        $item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}", [
                'species_name' => '更新された品種名',
            ]);

        $response->assertStatus(422);
    }

    public function test_admin_can_delete_item(): void
    {
        $item = Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseMissing('items', [
            'id' => $item->id,
        ]);
    }

    public function test_admin_cannot_delete_sold_item(): void
    {
        $item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}");

        $response->assertStatus(422);
    }

    public function test_admin_can_bulk_update_status(): void
    {
        $items = Item::factory()->count(3)->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/auctions/{$this->auction->id}/items/bulk-status", [
                'item_ids' => $items->pluck('id')->toArray(),
                'status' => 'registered',
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        foreach ($items as $item) {
            $this->assertDatabaseHas('items', [
                'id' => $item->id,
                'status' => 'registered',
            ]);
        }
    }

    public function test_admin_can_download_csv_template(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->get("/api/admin/auctions/{$this->auction->id}/items/template");

        $response->assertStatus(200)
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    }

    public function test_item_creation_requires_species_name(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/items", [
                'quantity' => 1,
                'start_price' => 30000,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['species_name']);
    }

    public function test_item_creation_requires_positive_quantity(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/items", [
                'species_name' => 'テスト品種',
                'quantity' => 0,
                'start_price' => 30000,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['quantity']);
    }

    public function test_item_creation_requires_positive_start_price(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/items", [
                'species_name' => 'テスト品種',
                'quantity' => 1,
                'start_price' => 0,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['start_price']);
    }
}
