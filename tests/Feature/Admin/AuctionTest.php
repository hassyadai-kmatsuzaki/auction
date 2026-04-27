<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\User;
use Tests\TestCase;

class AuctionTest extends TestCase
{
    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
    }

    public function test_admin_can_list_auctions(): void
    {
        Auction::factory()->count(5)->create(['created_by' => $this->admin->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/auctions');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'auctions',
                    'pagination',
                ],
            ]);
    }

    public function test_admin_can_create_auction(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/auctions', [
                'title' => 'テストオークション',
                'event_date' => now()->addDays(7)->format('Y-m-d'),
                'start_time' => '10:00',
                'description' => 'テスト説明',
                'lane_count' => 3,
                'default_bid_increment' => 100,
                'countdown_seconds' => 10,
                'payment_deadline_hours' => 72,
                'shipping_deadline_hours' => 168,
            ]);

        $response->assertStatus(201)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('auctions', [
            'title' => 'テストオークション',
        ]);
    }

    public function test_admin_can_view_auction_detail(): void
    {
        $auction = Auction::factory()->create(['created_by' => $this->admin->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/auctions/{$auction->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'auction' => ['id', 'title', 'event_date', 'status'],
                ],
            ]);
    }

    public function test_admin_can_update_auction(): void
    {
        $auction = Auction::factory()->preparing()->create(['created_by' => $this->admin->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/auctions/{$auction->id}", [
                'title' => '更新されたタイトル',
                'event_date' => now()->addDays(14)->format('Y-m-d'),
                'start_time' => '14:00',
                'description' => $auction->description,
                'lane_count' => $auction->lane_count,
                'default_bid_increment' => $auction->default_bid_increment ?? 100,
                'countdown_seconds' => $auction->countdown_seconds ?? 10,
                'payment_deadline_hours' => $auction->payment_deadline_hours ?? 72,
                'shipping_deadline_hours' => $auction->shipping_deadline_hours ?? 168,
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('auctions', [
            'id' => $auction->id,
            'title' => '更新されたタイトル',
        ]);
    }

    public function test_admin_can_delete_auction_without_items(): void
    {
        $auction = Auction::factory()->preparing()->create(['created_by' => $this->admin->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/auctions/{$auction->id}");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        // Auction は SoftDelete を使うので deleted_at が入っていることを確認
        $this->assertSoftDeleted('auctions', [
            'id' => $auction->id,
        ]);
    }

    public function test_admin_cannot_delete_auction_with_items(): void
    {
        $auction = Auction::factory()->create(['created_by' => $this->admin->id]);
        Item::factory()->create(['auction_id' => $auction->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/auctions/{$auction->id}");

        $response->assertStatus(403);
    }

    public function test_admin_can_start_scheduled_auction(): void
    {
        // ProcessAuctionCountdownJob は QUEUE_CONNECTION=sync 下で
        // 即時に進行して 'finished' に至るため、Queue::fake() でジョブをキャプチャする。
        \Illuminate\Support\Facades\Queue::fake();

        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
        $seller = $this->createSeller();
        $sellerProfile = \App\Models\SellerProfile::factory()->create(['user_id' => $seller->id]);
        Item::factory()->registered()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);
        Lane::factory()->create(['auction_id' => $auction->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$auction->id}/live/start");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('auctions', [
            'id' => $auction->id,
            'status' => 'live',
        ]);
    }

    public function test_admin_can_finish_live_auction(): void
    {
        $auction = Auction::factory()->live()->create(['created_by' => $this->admin->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$auction->id}/live/finish");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('auctions', [
            'id' => $auction->id,
            'status' => 'finished',
        ]);
    }

    public function test_admin_can_cancel_auction(): void
    {
        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/auctions/{$auction->id}/status", ['status' => 'cancelled']);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('auctions', [
            'id' => $auction->id,
            'status' => 'cancelled',
        ]);
    }

    public function test_non_admin_cannot_access_admin_auctions(): void
    {
        $participant = $this->createParticipant();

        $response = $this->actingAs($participant, 'sanctum')
            ->getJson('/api/admin/auctions');

        $response->assertStatus(403);
    }

    public function test_unauthenticated_user_cannot_access_admin_auctions(): void
    {
        $response = $this->getJson('/api/admin/auctions');

        $response->assertStatus(401);
    }

    public function test_admin_can_update_lane_count(): void
    {
        $auction = Auction::factory()->scheduled()->create([
            'created_by' => $this->admin->id,
            'lane_count' => 3,
        ]);
        // 既存レーン作成
        for ($i = 1; $i <= 3; $i++) {
            Lane::factory()->create(['auction_id' => $auction->id, 'lane_number' => $i]);
        }

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/auctions/{$auction->id}/lane-count", [
                'lane_count' => 5,
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('auctions', [
            'id' => $auction->id,
            'lane_count' => 5,
        ]);
    }
}
