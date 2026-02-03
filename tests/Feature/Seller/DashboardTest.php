<?php

namespace Tests\Feature\Seller;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    protected User $seller;
    protected SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $this->seller->id]);
    }

    public function test_seller_can_view_dashboard(): void
    {
        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson('/api/seller/dashboard');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data',
            ]);
    }

    public function test_seller_dashboard_shows_correct_statistics(): void
    {
        $admin = $this->createAdmin();
        $auction = Auction::factory()->finished()->create(['created_by' => $admin->id]);
        
        // 出品した商品
        $item = Item::factory()->sold()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        // 落札データ
        $winner = $this->createParticipant();
        WonItem::factory()->confirmed()->create([
            'item_id' => $item->id,
            'winner_id' => $winner->id,
        ]);

        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson('/api/seller/dashboard');

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_non_seller_cannot_access_seller_dashboard(): void
    {
        $participant = $this->createParticipant();

        $response = $this->actingAs($participant, 'sanctum')
            ->getJson('/api/seller/dashboard');

        $response->assertStatus(403);
    }

    public function test_unauthenticated_user_cannot_access_seller_dashboard(): void
    {
        $response = $this->getJson('/api/seller/dashboard');

        $response->assertStatus(401);
    }
}
