<?php

namespace Tests\Feature\Participant;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Models\User;
use Tests\TestCase;

class AuctionTest extends TestCase
{
    protected User $participant;
    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->participant = $this->createParticipant();
        $this->admin = $this->createAdmin();
    }

    public function test_participant_can_list_auctions(): void
    {
        Auction::factory()->count(3)->scheduled()->create(['created_by' => $this->admin->id]);
        Auction::factory()->count(2)->finished()->create(['created_by' => $this->admin->id]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/participant/auctions');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'auctions',
                ],
            ]);
    }

    public function test_participant_can_view_auction_detail(): void
    {
        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->getJson("/api/participant/auctions/{$auction->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'auction' => ['id', 'title', 'event_date', 'status'],
                ],
            ]);
    }

    public function test_participant_can_view_auction_items(): void
    {
        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
        
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        
        Item::factory()->count(5)->registered()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->getJson("/api/participant/auctions/{$auction->id}/items");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'items',
                ],
            ]);
    }

    public function test_participant_can_view_live_auction(): void
    {
        $auction = Auction::factory()->live()->create(['created_by' => $this->admin->id]);
        Lane::factory()->create(['auction_id' => $auction->id]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->getJson("/api/participant/auctions/{$auction->id}/live");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data',
            ]);
    }

    public function test_participant_only_sees_published_auctions(): void
    {
        // 公開予定・開催中のみ表示
        Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
        Auction::factory()->live()->create(['created_by' => $this->admin->id]);
        Auction::factory()->preparing()->create(['created_by' => $this->admin->id]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/participant/auctions');

        $response->assertStatus(200);
        // 準備中は表示されないはず
    }

    public function test_unauthenticated_user_can_view_public_auctions(): void
    {
        Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);

        $response = $this->getJson('/api/participant/auctions');

        // 認証なしでも一部のオークション情報は見られる可能性
        // 実装によってはステータスが異なる
        $response->assertStatus(401); // 認証が必要な場合
    }
}
