<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Models\User;
use Tests\TestCase;

/**
 * 生体「審査中(draft) / 承認済み(registered)」ワークフローの検証。
 *
 * - 管理画面からの新規登録は審査中(draft)で受け入れる
 * - 審査中でもレーン割り当てができる
 * - 審査中は落札ユーザーに表示されない（承認すると表示される）
 * - 承認(draft→registered)してもレーン割り当ては保持される
 */
class ItemReviewWorkflowTest extends TestCase
{
    protected User $admin;
    protected User $participant;
    protected Auction $auction;
    protected Lane $lane;
    protected SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->participant = $this->createParticipant();
        $this->auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
        $this->lane = Lane::factory()->create(['auction_id' => $this->auction->id, 'lane_number' => 1]);

        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
    }

    public function test_admin_created_item_is_registered_as_draft(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/items", [
                'species_name' => '審査中メダカ',
                'quantity' => 1,
                'start_price' => 1000,
                'seller_profile_id' => $this->sellerProfile->id,
            ]);

        $response->assertStatus(201)->assertJson(['success' => true]);

        // 管理画面からの登録は審査中(draft)になる
        $this->assertDatabaseHas('items', [
            'auction_id' => $this->auction->id,
            'species_name' => '審査中メダカ',
            'status' => 'draft',
        ]);
    }

    public function test_draft_item_appears_in_lane_unassigned_pool(): void
    {
        $draft = Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/auctions/{$this->auction->id}/lanes");

        $response->assertStatus(200);
        $ids = collect($response->json('data.unassigned_items'))->pluck('id')->all();
        $this->assertContains($draft->id, $ids, '審査中(draft)の生体がレーン未割当リストに出るべき');
    }

    public function test_draft_item_can_be_assigned_to_lane(): void
    {
        $draft = Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/{$this->lane->id}/items", [
                'item_id' => $draft->id,
            ]);

        $response->assertStatus(200)->assertJson(['success' => true]);
        $this->assertDatabaseHas('lane_items', [
            'lane_id' => $this->lane->id,
            'item_id' => $draft->id,
        ]);
    }

    public function test_approving_draft_keeps_lane_assignment(): void
    {
        $draft = Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        $this->lane->items()->attach($draft->id, ['sequence_order' => 1]);

        // 承認 = draft → registered
        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/auctions/{$this->auction->id}/items/{$draft->id}/status", [
                'status' => 'registered',
            ]);

        $response->assertStatus(200)->assertJson(['success' => true]);

        // 承認してもレーン割り当ては保持される
        $this->assertDatabaseHas('lane_items', [
            'lane_id' => $this->lane->id,
            'item_id' => $draft->id,
        ]);
    }

    public function test_cancelling_item_detaches_from_lane(): void
    {
        $item = Item::factory()->registered()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        $this->lane->items()->attach($item->id, ['sequence_order' => 1]);

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}/status", [
                'status' => 'cancelled',
            ])->assertStatus(200);

        // キャンセルはレーンから除外される
        $this->assertDatabaseMissing('lane_items', [
            'lane_id' => $this->lane->id,
            'item_id' => $item->id,
        ]);
    }

    public function test_draft_item_hidden_from_participant_but_registered_visible(): void
    {
        Item::factory()->count(2)->registered()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->getJson("/api/participant/auctions/{$this->auction->id}/items");

        $response->assertStatus(200);
        // 審査中(draft)は数に含まれず、承認済み(registered) の 2 件のみ表示される
        $this->assertSame(2, $response->json('data.total_items'));
    }
}
