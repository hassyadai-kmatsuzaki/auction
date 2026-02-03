<?php

namespace Tests\Feature\Admin;

use App\Models\SellerProfile;
use App\Models\User;
use Tests\TestCase;

class UserTest extends TestCase
{
    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
    }

    public function test_admin_can_list_users(): void
    {
        $seller = $this->createSeller();
        SellerProfile::factory()->create(['user_id' => $seller->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/users');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'data', // Laravel paginator structure
                ],
            ]);
    }

    public function test_admin_can_filter_users_by_role(): void
    {
        $this->createSeller();
        $this->createParticipant();

        // Filter sellers
        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/users?role=seller');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data',
            ]);
    }

    public function test_admin_can_view_user_detail(): void
    {
        $seller = $this->createSeller();
        SellerProfile::factory()->create(['user_id' => $seller->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/users/{$seller->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'user' => ['id', 'name', 'email'],
                ],
            ]);
    }

    public function test_admin_can_create_seller(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/users', [
                'name' => 'テスト出品者',
                'email' => 'testseller@example.com',
                'roles' => ['seller'],
            ]);

        $response->assertStatus(201)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('users', [
            'email' => 'testseller@example.com',
        ]);
    }

    public function test_admin_can_create_buyer(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/users', [
                'name' => 'テスト買受者',
                'email' => 'testbuyer@example.com',
                'roles' => ['participant'],
            ]);

        $response->assertStatus(201)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('users', [
            'email' => 'testbuyer@example.com',
        ]);
    }

    public function test_admin_can_update_user(): void
    {
        $seller = $this->createSeller();
        SellerProfile::factory()->create(['user_id' => $seller->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/users/{$seller->id}", [
                'name' => '更新された名前',
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('users', [
            'id' => $seller->id,
            'name' => '更新された名前',
        ]);
    }

    public function test_admin_can_delete_user(): void
    {
        $buyer = $this->createParticipant();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/users/{$buyer->id}");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        // Soft delete - check is_active is false
        $this->assertDatabaseHas('users', [
            'id' => $buyer->id,
            'is_active' => false,
        ]);
    }

    public function test_user_creation_requires_email(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/users', [
                'name' => 'テストユーザー',
                'roles' => ['participant'],
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_user_creation_requires_roles(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/users', [
                'name' => 'テストユーザー',
                'email' => 'test@example.com',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['roles']);
    }

    public function test_non_admin_cannot_list_users(): void
    {
        $seller = $this->createSeller();

        $response = $this->actingAs($seller, 'sanctum')
            ->getJson('/api/admin/users');

        // Admin middleware should reject non-admin users
        $response->assertStatus(403);
    }

    public function test_admin_can_restore_deleted_user(): void
    {
        $buyer = $this->createParticipant();

        // まず削除
        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/users/{$buyer->id}");

        // 削除されたことを確認
        $this->assertDatabaseHas('users', [
            'id' => $buyer->id,
            'is_active' => false,
        ]);

        // 復元
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/users/{$buyer->id}/restore");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        // 復元されたことを確認
        $this->assertDatabaseHas('users', [
            'id' => $buyer->id,
            'is_active' => true,
        ]);
    }

    public function test_admin_can_search_users(): void
    {
        User::factory()->create(['name' => '検索対象ユーザー']);
        User::factory()->create(['name' => '別のユーザー']);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/users?search=検索対象');

        $response->assertStatus(200);
    }
}
