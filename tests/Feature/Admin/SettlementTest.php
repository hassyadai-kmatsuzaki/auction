<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\SellerSettlement;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

/**
 * 管理者向け SellerSettlement (出品者精算) のテスト。
 *
 * - 一覧取得時に WonItem から不足分を自動補完
 * - 詳細・更新・mark-paid・recalculate
 */
class SettlementTest extends TestCase
{
    private User $admin;
    private User $seller;
    private SellerProfile $sellerProfile;
    private Auction $auction;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $this->seller->id]);
        $this->auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
    }

    /** WonItem を 1件作って auction-seller の組み合わせを成立させる */
    private function makeWonItem(int $totalAmount = 30000): WonItem
    {
        $item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        return WonItem::factory()->create([
            'item_id' => $item->id,
            'winner_id' => $this->createParticipant()->id,
            'total_amount' => $totalAmount,
            'commission_amount' => 1500,
            'shipping_fee' => 500,
            'shipping_approved_at' => now(),
        ]);
    }

    public function test_index_synthesizes_settlement_from_won_items_when_missing(): void
    {
        $this->makeWonItem();
        $this->assertDatabaseMissing('seller_settlements', [
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/settlements');

        $response->assertOk();
        // 自動生成されているはず
        $this->assertDatabaseHas('seller_settlements', [
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'status' => SellerSettlement::STATUS_PENDING,
        ]);
    }

    public function test_index_can_filter_by_status(): void
    {
        $this->makeWonItem();
        $settlement = SellerSettlement::firstOrCreate([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ], ['status' => SellerSettlement::STATUS_PENDING]);
        $settlement->update(['status' => SellerSettlement::STATUS_COMPLETED]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/settlements?status=completed');

        $response->assertOk();
        $items = collect($response->json('data.data'));
        $this->assertTrue($items->every(fn ($s) => $s['status'] === 'completed'));
    }

    public function test_show_returns_settlement_with_items(): void
    {
        $w = $this->makeWonItem();
        $settlement = SellerSettlement::create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'status' => SellerSettlement::STATUS_PENDING,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/settlements/{$settlement->id}");

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'settlement' => ['id', 'auction_id', 'seller_profile_id', 'status', 'total_sales'],
                    'items',
                ],
            ]);
        $this->assertSame($w->id, $response->json('data.items.0.id'));
    }

    public function test_update_changes_status_and_payment_fields(): void
    {
        $this->makeWonItem();
        $settlement = SellerSettlement::create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'status' => SellerSettlement::STATUS_PENDING,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/settlements/{$settlement->id}", [
                'status' => SellerSettlement::STATUS_PROCESSING,
                'payment_method' => 'bank_transfer',
                'transaction_reference' => 'TXN_001',
                'note' => '振込予定',
            ]);

        $response->assertOk();
        $settlement->refresh();
        $this->assertSame('processing', $settlement->status);
        $this->assertSame('bank_transfer', $settlement->payment_method);
    }

    public function test_update_to_completed_auto_fills_paid_at_and_paid_by(): void
    {
        $this->makeWonItem();
        $settlement = SellerSettlement::create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'status' => SellerSettlement::STATUS_PENDING,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/settlements/{$settlement->id}", [
                'status' => SellerSettlement::STATUS_COMPLETED,
            ]);

        $response->assertOk();
        $settlement->refresh();
        $this->assertSame('completed', $settlement->status);
        $this->assertNotNull($settlement->paid_at);
        $this->assertSame($this->admin->id, $settlement->paid_by);
    }

    public function test_revert_from_completed_clears_paid_fields(): void
    {
        $this->makeWonItem();
        $settlement = SellerSettlement::create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'status' => SellerSettlement::STATUS_COMPLETED,
            'paid_at' => now()->subDay(),
            'paid_by' => $this->admin->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/settlements/{$settlement->id}", [
                'status' => SellerSettlement::STATUS_PROCESSING,
            ]);

        $response->assertOk();
        $settlement->refresh();
        $this->assertNull($settlement->paid_at);
        $this->assertNull($settlement->paid_by);
    }

    public function test_invalid_status_is_rejected(): void
    {
        $this->makeWonItem();
        $settlement = SellerSettlement::create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'status' => SellerSettlement::STATUS_PENDING,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/settlements/{$settlement->id}", [
                'status' => 'totally_wrong_status',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    public function test_mark_paid_endpoint_completes_settlement(): void
    {
        $this->makeWonItem();
        $settlement = SellerSettlement::create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'status' => SellerSettlement::STATUS_PENDING,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/settlements/{$settlement->id}/mark-paid", [
                'payment_method' => 'cash',
                'transaction_reference' => 'CASH_001',
            ]);

        $response->assertOk();
        $settlement->refresh();
        $this->assertSame('completed', $settlement->status);
        $this->assertNotNull($settlement->paid_at);
        $this->assertSame('cash', $settlement->payment_method);
    }

    public function test_recalculate_endpoint_updates_totals(): void
    {
        $this->makeWonItem(20000);
        $settlement = SellerSettlement::create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'status' => SellerSettlement::STATUS_PENDING,
            'total_sales' => 0,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/settlements/{$settlement->id}/recalculate");

        $response->assertOk();
        $settlement->refresh();
        $this->assertGreaterThan(0, (int) $settlement->total_sales);
    }

    public function test_non_admin_cannot_access_settlement_admin(): void
    {
        $participant = $this->createParticipant();
        $this->actingAs($participant, 'sanctum')
            ->getJson('/api/admin/settlements')
            ->assertStatus(403);
    }
}
