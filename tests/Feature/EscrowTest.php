<?php

namespace Tests\Feature;

use App\Models\EscrowTransaction;
use App\Models\User;
use App\Models\Role;
use App\Models\WonItem;
use App\Services\EscrowService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EscrowTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private EscrowTransaction $escrow;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::firstOrCreate(['name' => 'admin', 'display_name' => '管理者']);
        $this->admin = User::factory()->create(['status' => 'approved', 'is_active' => true]);
        $this->admin->roles()->attach($adminRole);

        $this->escrow = EscrowTransaction::factory()->create([
            'status' => 'awaiting_payment',
            'amount' => 10000,
        ]);
    }

    public function test_admin_can_list_escrow_transactions(): void
    {
        $response = $this->actingAs($this->admin)
            ->getJson('/api/admin/escrow');

        $response->assertOk();
    }

    public function test_confirm_payment_transitions_to_held(): void
    {
        $response = $this->actingAs($this->admin)
            ->postJson("/api/admin/escrow/{$this->escrow->id}/confirm-payment");

        $response->assertOk();
        $this->assertDatabaseHas('escrow_transactions', [
            'id' => $this->escrow->id,
            'status' => 'payment_held',
        ]);
    }

    public function test_release_requires_payment_held_status(): void
    {
        // awaiting_payment 状態ではリリースできない
        $response = $this->actingAs($this->admin)
            ->postJson("/api/admin/escrow/{$this->escrow->id}/release");

        $response->assertStatus(500);
    }

    public function test_full_escrow_lifecycle(): void
    {
        // 入金確認
        $this->actingAs($this->admin)
            ->postJson("/api/admin/escrow/{$this->escrow->id}/confirm-payment")
            ->assertOk();

        // リリース
        $this->actingAs($this->admin)
            ->postJson("/api/admin/escrow/{$this->escrow->id}/release")
            ->assertOk();

        $this->assertDatabaseHas('escrow_transactions', [
            'id' => $this->escrow->id,
            'status' => 'released_to_seller',
        ]);
    }

    public function test_admin_can_filter_escrow_by_status(): void
    {
        $disputed = EscrowTransaction::factory()->create(['status' => 'disputed', 'amount' => 1000]);
        $awaiting = EscrowTransaction::factory()->create(['status' => 'awaiting_payment', 'amount' => 2000]);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/admin/escrow?status=disputed');

        $response->assertOk();
        $items = collect($response->json('data.data'));
        $this->assertTrue($items->contains('id', $disputed->id));
        $this->assertFalse($items->contains('id', $awaiting->id));
    }

    public function test_admin_can_refund_when_payment_held(): void
    {
        // confirmPayment しないと refund できない
        $this->actingAs($this->admin)
            ->postJson("/api/admin/escrow/{$this->escrow->id}/confirm-payment")
            ->assertOk();

        $this->actingAs($this->admin)
            ->postJson("/api/admin/escrow/{$this->escrow->id}/refund", [
                'reason' => '商品不良のため返金',
            ])
            ->assertOk();

        $this->assertDatabaseHas('escrow_transactions', [
            'id' => $this->escrow->id,
            'status' => 'refunded',
            'notes' => '商品不良のため返金',
        ]);
        $this->assertDatabaseHas('won_items', [
            'id' => $this->escrow->won_item_id,
            'payment_status' => 'refunded',
        ]);
    }

    public function test_refund_requires_reason(): void
    {
        $this->actingAs($this->admin)
            ->postJson("/api/admin/escrow/{$this->escrow->id}/confirm-payment")
            ->assertOk();

        $this->actingAs($this->admin)
            ->postJson("/api/admin/escrow/{$this->escrow->id}/refund", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['reason']);
    }

    public function test_refund_rejects_when_not_held_or_disputed(): void
    {
        // awaiting_payment 状態 (= 入金確認前) の refund は 500
        $this->actingAs($this->admin)
            ->postJson("/api/admin/escrow/{$this->escrow->id}/refund", ['reason' => 'x'])
            ->assertStatus(500);
    }

    public function test_admin_can_open_dispute(): void
    {
        $this->actingAs($this->admin)
            ->postJson("/api/admin/escrow/{$this->escrow->id}/dispute", [
                'reason' => '商品が届かない',
            ])
            ->assertOk();

        $this->assertDatabaseHas('escrow_transactions', [
            'id' => $this->escrow->id,
            'status' => 'disputed',
            'notes' => '商品が届かない',
        ]);
    }

    public function test_admin_can_refund_after_dispute(): void
    {
        // dispute → refund というフロー
        $this->actingAs($this->admin)
            ->postJson("/api/admin/escrow/{$this->escrow->id}/dispute", ['reason' => 'x'])
            ->assertOk();

        $this->actingAs($this->admin)
            ->postJson("/api/admin/escrow/{$this->escrow->id}/refund", ['reason' => '紛争解決'])
            ->assertOk();

        $this->assertDatabaseHas('escrow_transactions', [
            'id' => $this->escrow->id,
            'status' => 'refunded',
        ]);
    }

    public function test_dispute_requires_reason(): void
    {
        $this->actingAs($this->admin)
            ->postJson("/api/admin/escrow/{$this->escrow->id}/dispute", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['reason']);
    }

    public function test_create_from_won_item_creates_transaction(): void
    {
        $service = app(\App\Services\EscrowService::class);

        // EscrowTransactionFactory で都度 WonItem が作られるが、ここでは別途作って渡す
        $wonItem = \App\Models\WonItem::factory()->create();
        // sellerProfile が必須
        $wonItem->item->update([
            'seller_profile_id' => \App\Models\SellerProfile::factory()->create([
                'user_id' => $this->createSeller()->id,
            ])->id,
        ]);

        $escrow = $service->createFromWonItem($wonItem->fresh('item.sellerProfile'));

        $this->assertDatabaseHas('escrow_transactions', [
            'id' => $escrow->id,
            'won_item_id' => $wonItem->id,
            'status' => 'awaiting_payment',
        ]);
        $this->assertSame((int) $wonItem->total_amount, (int) $escrow->amount);
    }

    public function test_create_from_won_item_throws_when_buyer_missing(): void
    {
        $service = app(\App\Services\EscrowService::class);
        $wonItem = \App\Models\WonItem::factory()->make(['winner_id' => 999999]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/買い手ユーザーが存在しません/');
        $service->createFromWonItem($wonItem);
    }
}
