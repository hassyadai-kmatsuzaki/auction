<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Models\User;
use Tests\TestCase;

class LaneTest extends TestCase
{
    protected User $admin;
    protected Auction $auction;
    protected Lane $lane;
    protected Item $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->auction = Auction::factory()->scheduled()->create([
            'created_by' => $this->admin->id,
            // 生体単位の割当 API は出品者順序の確定後にのみ使える（LaneGroupModeTest で未確定時を検証）
            'lane_order_confirmed_at' => now(),
        ]);
        $this->lane = Lane::factory()->create(['auction_id' => $this->auction->id, 'lane_number' => 1]);
        
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $this->item = Item::factory()->registered()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);
    }

    public function test_admin_can_list_lanes(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/auctions/{$this->auction->id}/lanes");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'auction',
                    'lanes',
                    'unassigned_items',
                ],
            ]);
    }

    public function test_admin_can_assign_item_to_lane(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/{$this->lane->id}/items", [
                'item_id' => $this->item->id,
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('lane_items', [
            'lane_id' => $this->lane->id,
            'item_id' => $this->item->id,
        ]);
    }

    public function test_admin_can_remove_item_from_lane(): void
    {
        // まずアイテムを割り当て
        $this->lane->items()->attach($this->item->id, ['sequence_order' => 1]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/auctions/{$this->auction->id}/lanes/{$this->lane->id}/items/{$this->item->id}");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseMissing('lane_items', [
            'lane_id' => $this->lane->id,
            'item_id' => $this->item->id,
        ]);
    }

    public function test_admin_can_reorder_items_in_lane(): void
    {
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        
        $item2 = Item::factory()->registered()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);

        $this->lane->items()->attach($this->item->id, ['sequence_order' => 1]);
        $this->lane->items()->attach($item2->id, ['sequence_order' => 2]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/auctions/{$this->auction->id}/lanes/{$this->lane->id}/items/reorder", [
                'item_ids' => [$item2->id, $this->item->id],
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_admin_can_auto_assign_items(): void
    {
        Lane::factory()->create(['auction_id' => $this->auction->id, 'lane_number' => 2]);
        
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        
        Item::factory()->count(5)->registered()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/auto-assign");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_assigning_item_requires_item_id(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/{$this->lane->id}/items", []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['item_id']);
    }

    public function test_cannot_assign_nonexistent_item(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/{$this->lane->id}/items", [
                'item_id' => 99999,
            ]);

        $response->assertStatus(422);
    }

    public function test_non_admin_cannot_manage_lanes(): void
    {
        $participant = $this->createParticipant();

        $response = $this->actingAs($participant, 'sanctum')
            ->getJson("/api/admin/auctions/{$this->auction->id}/lanes");

        $response->assertStatus(403);
    }

    public function test_admin_can_create_additional_lane(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/create", [
                'lane_name' => 'B レーン',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.lane.lane_number', 2)
            ->assertJsonPath('data.lane.lane_name', 'B レーン');
    }

    public function test_create_lane_blocked_for_started_auction(): void
    {
        $this->auction->update(['status' => 'live']);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/create")
            ->assertStatus(400);
    }

    public function test_admin_cannot_exceed_10_lanes(): void
    {
        // 既存 1 + 9 = 10 レーン
        for ($i = 2; $i <= 10; $i++) {
            Lane::factory()->create(['auction_id' => $this->auction->id, 'lane_number' => $i]);
        }

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/create")
            ->assertStatus(400);
    }

    public function test_admin_can_delete_extra_lane(): void
    {
        $extra = Lane::factory()->create(['auction_id' => $this->auction->id, 'lane_number' => 2]);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/auctions/{$this->auction->id}/lanes/{$extra->id}")
            ->assertOk();

        $this->assertDatabaseMissing('lanes', ['id' => $extra->id]);
    }

    public function test_cannot_delete_last_lane(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/auctions/{$this->auction->id}/lanes/{$this->lane->id}")
            ->assertStatus(400);
    }

    public function test_delete_lane_blocked_for_started_auction(): void
    {
        $extra = Lane::factory()->create(['auction_id' => $this->auction->id, 'lane_number' => 2]);
        $this->auction->update(['status' => 'live']);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/auctions/{$this->auction->id}/lanes/{$extra->id}")
            ->assertStatus(400);
    }

    public function test_admin_can_update_lane_name(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/auctions/{$this->auction->id}/lanes/{$this->lane->id}", [
                'lane_name' => '高級魚レーン',
            ]);

        $response->assertOk();
        $this->assertSame('高級魚レーン', $this->lane->fresh()->lane_name);
    }

    public function test_admin_can_bulk_unassign_items(): void
    {
        $this->lane->items()->attach($this->item->id, ['sequence_order' => 1]);
        $this->assertSame(1, \DB::table('lane_items')->where('lane_id', $this->lane->id)->count());

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/bulk-unassign");

        $response->assertOk()
            ->assertJsonPath('data.unassigned_count', 1);

        $this->assertSame(0, \DB::table('lane_items')->where('lane_id', $this->lane->id)->count());
    }

    public function test_bulk_unassign_blocked_when_auction_started(): void
    {
        $this->auction->update(['status' => 'live']);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/bulk-unassign")
            ->assertStatus(400);
    }
}
