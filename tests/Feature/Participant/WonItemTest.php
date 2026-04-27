<?php

namespace Tests\Feature\Participant;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

class WonItemTest extends TestCase
{
    protected User $participant;
    protected User $admin;
    protected WonItem $wonItem;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->participant = $this->createParticipant();
        $this->admin = $this->createAdmin();

        $auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        
        $item = Item::factory()->sold()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);

        $this->wonItem = WonItem::factory()->create([
            'item_id' => $item->id,
            'winner_id' => $this->participant->id,
        ]);
    }

    public function test_participant_can_list_own_won_items(): void
    {
        $response = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/participant/won-items');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'auctions',
                    'summary',
                ],
            ]);
    }

    public function test_participant_can_view_won_item_detail(): void
    {
        $response = $this->actingAs($this->participant, 'sanctum')
            ->getJson("/api/participant/won-items/{$this->wonItem->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'won_item' => ['id', 'winning_price', 'payment_status'],
                ],
            ]);
    }

    public function test_participant_cannot_view_other_users_won_item(): void
    {
        $otherParticipant = $this->createParticipant();

        $response = $this->actingAs($otherParticipant, 'sanctum')
            ->getJson("/api/participant/won-items/{$this->wonItem->id}");

        // forWinner scope filters by winner_id, so it returns 404 (not found)
        $response->assertStatus(404);
    }

    public function test_participant_can_update_shipping_address(): void
    {
        $auctionId = $this->wonItem->item->auction_id;
        $response = $this->actingAs($this->participant, 'sanctum')
            ->putJson("/api/participant/auctions/{$auctionId}/address", [
                'shipping_postal_code' => '123-4567',
                'shipping_prefecture' => '東京都',
                'shipping_city' => '新宿区',
                'shipping_address_line1' => '新宿1-1-1',
                'shipping_name' => '新しい名前',
                'shipping_phone' => '090-1234-5678',
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('won_items', [
            'id' => $this->wonItem->id,
            'shipping_prefecture' => '東京都',
            'shipping_city' => '新宿区',
        ]);
    }

    public function test_participant_cannot_update_address_after_payment_confirmed(): void
    {
        $this->wonItem->update([
            'payment_status' => 'confirmed',
            'shipping_locked_at' => now(),
        ]);
        $auctionId = $this->wonItem->item->auction_id;

        $response = $this->actingAs($this->participant, 'sanctum')
            ->putJson("/api/participant/auctions/{$auctionId}/address", [
                'shipping_postal_code' => '530-0001',
                'shipping_prefecture' => '大阪府',
                'shipping_city' => '大阪市北区',
                'shipping_address_line1' => '梅田1-1-1',
                'shipping_name' => 'テスト太郎',
                'shipping_phone' => '090-1234-5678',
            ]);

        // canUpdateShippingAddress returns false, so 400 is returned
        $response->assertStatus(400);
    }

    public function test_address_update_requires_postal_code(): void
    {
        $auctionId = $this->wonItem->item->auction_id;
        $response = $this->actingAs($this->participant, 'sanctum')
            ->putJson("/api/participant/auctions/{$auctionId}/address", [
                'shipping_prefecture' => '東京都',
                'shipping_city' => '新宿区',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['shipping_postal_code']);
    }

    public function test_non_participant_cannot_access_won_items(): void
    {
        $seller = $this->createSeller();

        $response = $this->actingAs($seller, 'sanctum')
            ->getJson('/api/participant/won-items');

        $response->assertStatus(403);
    }

    public function test_unauthenticated_user_cannot_access_won_items(): void
    {
        $response = $this->getJson('/api/participant/won-items');

        $response->assertStatus(401);
    }
}
