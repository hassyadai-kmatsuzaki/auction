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
}
