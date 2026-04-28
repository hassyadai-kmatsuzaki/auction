<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\AuctionSellerOrder;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use Tests\TestCase;

/**
 * SellerOrderController のテスト。
 *
 * - 認可（admin 専用）
 * - 出品者順序の取得
 * - randomize / reorder / reorderItems の正常系・エラー系
 */
class SellerOrderTest extends TestCase
{
    private User $admin;
    private SellerProfile $sellerA;
    private SellerProfile $sellerB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->sellerA = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
        $this->sellerB = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
    }

    private function preparingAuction(): Auction
    {
        return Auction::factory()->preparing()->create(['created_by' => $this->admin->id]);
    }

    public function test_index_は_未認証で401(): void
    {
        $auction = $this->preparingAuction();
        $this->getJson("/api/admin/auctions/{$auction->id}/seller-order")->assertStatus(401);
    }

    public function test_index_は_非adminで403(): void
    {
        $auction = $this->preparingAuction();
        $participant = $this->createParticipant();
        $this->actingAs($participant, 'sanctum')
            ->getJson("/api/admin/auctions/{$auction->id}/seller-order")
            ->assertStatus(403);
    }

    public function test_index_は_seller_orders一覧と編集可否を返す(): void
    {
        $auction = $this->preparingAuction();
        AuctionSellerOrder::create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerA->id,
            'display_order' => 1,
        ]);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/auctions/{$auction->id}/seller-order");
        $r->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.is_editable', true)
            ->assertJsonStructure(['data' => ['seller_orders', 'is_editable']]);
        $this->assertSame(1, count($r->json('data.seller_orders')));
    }

    public function test_index_は_live_オークションでis_editableがfalse(): void
    {
        $auction = Auction::factory()->live()->create(['created_by' => $this->admin->id]);
        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/auctions/{$auction->id}/seller-order");
        $r->assertOk()->assertJsonPath('data.is_editable', false);
    }

    public function test_randomize_は_出品者順序を作成する(): void
    {
        $auction = $this->preparingAuction();
        Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerA->id,
        ]);
        Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerB->id,
        ]);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$auction->id}/seller-order/randomize");
        $r->assertOk()->assertJsonPath('success', true);
        $this->assertSame(2, AuctionSellerOrder::where('auction_id', $auction->id)->count());
    }

    public function test_randomize_は_対象生体なしで400(): void
    {
        $auction = $this->preparingAuction();
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$auction->id}/seller-order/randomize")
            ->assertStatus(400);
    }

    public function test_randomize_は_live_オークションで400(): void
    {
        $auction = Auction::factory()->live()->create(['created_by' => $this->admin->id]);
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$auction->id}/seller-order/randomize")
            ->assertStatus(400);
    }

    public function test_reorder_は_seller_orders更新する(): void
    {
        $auction = $this->preparingAuction();
        $r = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/auctions/{$auction->id}/seller-order/reorder", [
                'seller_orders' => [
                    ['seller_profile_id' => $this->sellerA->id, 'display_order' => 2],
                    ['seller_profile_id' => $this->sellerB->id, 'display_order' => 1],
                ],
            ]);
        $r->assertOk();
        $this->assertSame(2, AuctionSellerOrder::where('auction_id', $auction->id)
            ->where('seller_profile_id', $this->sellerA->id)
            ->value('display_order'));
    }

    public function test_reorder_は_バリデーション違反で422(): void
    {
        $auction = $this->preparingAuction();
        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/auctions/{$auction->id}/seller-order/reorder", [
                'seller_orders' => [['display_order' => 1]],
            ])
            ->assertStatus(422);
    }

    public function test_reorderItems_は_生体のseller_display_orderを更新する(): void
    {
        $auction = $this->preparingAuction();
        $item = Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerA->id,
        ]);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/auctions/{$auction->id}/seller-order/{$this->sellerA->id}/items/reorder", [
                'items' => [['item_id' => $item->id, 'seller_display_order' => 5]],
            ]);
        $r->assertOk();
        $this->assertSame(5, $item->fresh()->seller_display_order);
    }
}
