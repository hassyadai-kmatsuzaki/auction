<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

class WonItemTest extends TestCase
{
    protected User $admin;
    protected Auction $auction;
    protected Item $item;
    protected WonItem $wonItem;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        
        $this->item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);

        $winner = $this->createParticipant();
        $this->wonItem = WonItem::factory()->create([
            'item_id' => $this->item->id,
            'winner_id' => $winner->id,
        ]);
    }

    public function test_admin_can_list_won_items_auctions(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/won-items-auctions');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'auctions',
                ],
            ]);
    }

    public function test_admin_can_list_won_items_for_auction(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/auctions/{$this->auction->id}/won-items");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'auction',
                    'won_items',
                    'pagination',
                    'statistics',
                ],
            ]);
    }

    public function test_admin_can_view_won_item_detail(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/won-items/{$this->wonItem->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'won_item' => ['id', 'winning_price', 'payment_status', 'delivery_status'],
                ],
            ]);
    }

    public function test_admin_can_confirm_payment(): void
    {
        $wonItem = WonItem::factory()->paid()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->createParticipant()->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/won-items/{$wonItem->id}/confirm-payment");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('won_items', [
            'id' => $wonItem->id,
            'payment_status' => 'confirmed',
        ]);
    }

    public function test_admin_can_ship_item(): void
    {
        $wonItem = WonItem::factory()->confirmed()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->createParticipant()->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/won-items/{$wonItem->id}/ship", [
                'shipping_company' => 'ヤマト運輸',
                'tracking_number' => '1234-5678-9012',
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('won_items', [
            'id' => $wonItem->id,
            'delivery_status' => 'shipped',
            'tracking_number' => '1234-5678-9012',
        ]);
    }

    public function test_admin_cannot_ship_without_payment_confirmation(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/won-items/{$this->wonItem->id}/ship", [
                'shipping_company' => 'ヤマト運輸',
                'tracking_number' => '1234-5678-9012',
            ]);

        $response->assertStatus(400);
    }

    public function test_admin_can_complete_delivery(): void
    {
        $wonItem = WonItem::factory()->shipped()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->createParticipant()->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/won-items/{$wonItem->id}/complete");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('won_items', [
            'id' => $wonItem->id,
            'delivery_status' => 'completed',
        ]);
    }

    public function test_admin_can_update_notes(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/won-items/{$this->wonItem->id}/notes", [
                'notes' => 'テストメモ',
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('won_items', [
            'id' => $this->wonItem->id,
            'notes' => 'テストメモ',
        ]);
    }

    public function test_shipping_requires_company_and_tracking_number(): void
    {
        $wonItem = WonItem::factory()->confirmed()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->createParticipant()->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/won-items/{$wonItem->id}/ship", []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['shipping_company', 'tracking_number']);
    }

    public function test_non_admin_cannot_access_won_items(): void
    {
        $participant = $this->createParticipant();

        $response = $this->actingAs($participant, 'sanctum')
            ->getJson("/api/admin/auctions/{$this->auction->id}/won-items");

        $response->assertStatus(403);
    }
}
