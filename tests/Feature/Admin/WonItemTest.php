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
    protected SellerProfile $sellerProfile;
    protected Item $item;
    protected WonItem $wonItem;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        
        $this->item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $winner = $this->createParticipant();
        $this->wonItem = WonItem::factory()->create([
            'item_id' => $this->item->id,
            'winner_id' => $winner->id,
        ]);
    }

    protected function createNewItemWithWonItem(string $state = 'create'): WonItem
    {
        $item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $factory = WonItem::factory();
        if ($state === 'paid') {
            $factory = $factory->paid();
        } elseif ($state === 'confirmed') {
            $factory = $factory->confirmed();
        } elseif ($state === 'shipped') {
            $factory = $factory->shipped();
        }

        return $factory->create([
            'item_id' => $item->id,
            'winner_id' => $this->createParticipant()->id,
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
        $wonItem = $this->createNewItemWithWonItem('paid');

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
        $wonItem = $this->createNewItemWithWonItem('confirmed');
        // 送料未承認の発送は 409 で拒否される仕様のため、承認済みにしてから発送する
        $wonItem->update(['shipping_approved_at' => now()]);

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

    /**
     * 複数口の発送: 伝票番号を配列で受け取り、trim・空・重複を除いてカンマ区切りで保持する。
     */
    public function test_admin_can_ship_with_multiple_tracking_numbers(): void
    {
        $wonItem = $this->createNewItemWithWonItem('confirmed');
        $wonItem->update(['shipping_approved_at' => now()]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/won-items/{$wonItem->id}/ship", [
                'shipping_company' => 'ヤマト運輸',
                'tracking_numbers' => [' 1111-2222-3333 ', '4444-5555-6666', '', '4444-5555-6666'],
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true])
            ->assertJsonPath('data.tracking_numbers', ['1111-2222-3333', '4444-5555-6666']);

        $this->assertDatabaseHas('won_items', [
            'id' => $wonItem->id,
            'delivery_status' => 'shipped',
            'tracking_number' => '1111-2222-3333,4444-5555-6666',
        ]);
        $this->assertSame(['1111-2222-3333', '4444-5555-6666'], $wonItem->fresh()->tracking_numbers);
    }

    public function test_shipping_rejects_more_than_ten_tracking_numbers(): void
    {
        $wonItem = $this->createNewItemWithWonItem('confirmed');
        $wonItem->update(['shipping_approved_at' => now()]);
        $numbers = array_map(fn ($i) => sprintf('%012d', $i), range(1, 11));

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/won-items/{$wonItem->id}/ship", [
                'shipping_company' => 'ヤマト運輸',
                'tracking_numbers' => $numbers,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['tracking_numbers']);
    }

    public function test_won_item_list_returns_tracking_numbers_array(): void
    {
        $wonItem = $this->createNewItemWithWonItem('shipped');
        $wonItem->update(['tracking_number' => '1111-2222-3333,4444-5555-6666']);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/auctions/{$this->auction->id}/won-items?delivery_status=shipped");

        $response->assertStatus(200);
        $row = collect($response->json('data.won_items'))->firstWhere('id', $wonItem->id);
        $this->assertSame(['1111-2222-3333', '4444-5555-6666'], $row['tracking_numbers']);
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
        $wonItem = $this->createNewItemWithWonItem('shipped');

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
        $wonItem = $this->createNewItemWithWonItem('confirmed');

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
