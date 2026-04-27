<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Models\User;
use Tests\TestCase;

class LiveControllerTest extends TestCase
{
    protected User $admin;
    protected User $seller;
    protected SellerProfile $sellerProfile;
    protected Auction $auction;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $this->seller->id]);
    }

    protected function createLiveAuction(): Auction
    {
        $auction = Auction::factory()->live()->create([
            'created_by' => $this->admin->id,
            'lane_count' => 2,
        ]);

        // レーン作成
        for ($i = 1; $i <= 2; $i++) {
            Lane::factory()->active()->create([
                'auction_id' => $auction->id,
                'lane_number' => $i,
            ]);
        }

        // 登録済みアイテム作成
        Item::factory()->count(4)->registered()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        return $auction;
    }

    public function test_admin_can_list_live_auctions(): void
    {
        Auction::factory()->live()->create(['created_by' => $this->admin->id]);
        Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/live-auctions');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'auctions',
                ],
            ]);
    }

    public function test_admin_can_view_live_auction_detail(): void
    {
        $auction = $this->createLiveAuction();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/auctions/{$auction->id}/live");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'auction',
                    'lanes',
                ],
            ]);
    }

    public function test_admin_can_pause_live_auction(): void
    {
        $auction = $this->createLiveAuction();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$auction->id}/live/pause");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_admin_can_resume_paused_auction(): void
    {
        $auction = $this->createLiveAuction();

        // まず一時停止
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$auction->id}/live/pause");

        // 再開
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$auction->id}/live/resume");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_admin_can_proceed_to_next_item(): void
    {
        $auction = $this->createLiveAuction();
        $lane = $auction->lanes()->first();

        // レーンにアイテムを割り当て
        $items = $auction->items()->limit(2)->get();
        foreach ($items as $index => $item) {
            $lane->items()->attach($item->id, ['sequence_order' => $index + 1]);
        }

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/lanes/{$lane->id}/next-item");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data',
            ]);
    }

    public function test_admin_can_start_scheduled_auction(): void
    {
        \Illuminate\Support\Facades\Queue::fake();

        $auction = Auction::factory()->scheduled()->create([
            'created_by' => $this->admin->id,
            'lane_count' => 1,
        ]);
        Lane::factory()->create(['auction_id' => $auction->id]);
        Item::factory()->registered()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$auction->id}/live/start");

        $response->assertOk()->assertJson(['success' => true]);
        $auction->refresh();
        $this->assertSame('live', $auction->status);
    }

    public function test_admin_cannot_start_auction_without_items(): void
    {
        $auction = Auction::factory()->scheduled()->create([
            'created_by' => $this->admin->id,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$auction->id}/live/start")
            ->assertStatus(400);
    }

    public function test_admin_cannot_start_already_finished_auction(): void
    {
        $auction = Auction::factory()->finished()->create([
            'created_by' => $this->admin->id,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$auction->id}/live/start")
            ->assertStatus(400);
    }

    public function test_admin_can_finish_live_auction(): void
    {
        $auction = $this->createLiveAuction();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$auction->id}/live/finish");

        $response->assertOk()->assertJson(['success' => true]);
        $auction->refresh();
        $this->assertSame('finished', $auction->status);
    }

    public function test_admin_can_open_and_close_entrance(): void
    {
        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);

        // 開く
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$auction->id}/entrance/open")
            ->assertOk();

        // 状態を確認
        $statusResponse = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/auctions/{$auction->id}/entrance-status");
        $statusResponse->assertOk();

        // 閉じる
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$auction->id}/entrance/close")
            ->assertOk();
    }

    public function test_admin_can_get_countdown_status(): void
    {
        $auction = $this->createLiveAuction();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/auctions/{$auction->id}/countdown-status");

        $response->assertOk()
            ->assertJsonStructure(['success', 'data' => ['countdowns']]);
    }

    public function test_admin_can_adjust_item_price(): void
    {
        $auction = $this->createLiveAuction();
        $item = $auction->items()->first();

        // アイテムをライブ状態にする
        $item->update(['status' => 'live']);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/items/{$item->id}/price", [
                'new_price' => 15000,
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('items', [
            'id' => $item->id,
            'current_price' => 15000,
        ]);
    }

    public function test_non_admin_cannot_access_live_controls(): void
    {
        $participant = $this->createParticipant();
        $auction = $this->createLiveAuction();

        $response = $this->actingAs($participant, 'sanctum')
            ->getJson("/api/admin/auctions/{$auction->id}/live");

        $response->assertStatus(403);
    }

    public function test_unauthenticated_user_cannot_access_live_controls(): void
    {
        $auction = $this->createLiveAuction();

        $response = $this->getJson("/api/admin/auctions/{$auction->id}/live");

        $response->assertStatus(401);
    }
}
