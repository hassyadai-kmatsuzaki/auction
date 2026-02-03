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

    public function test_admin_can_list_sellers(): void
    {
        $seller = $this->createSeller();
        SellerProfile::factory()->create(['user_id' => $seller->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/sellers');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'sellers',
                    'pagination',
                ],
            ]);
    }

    public function test_admin_can_list_buyers(): void
    {
        $this->createParticipant();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/buyers');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'buyers',
                    'pagination',
                ],
            ]);
    }

    public function test_admin_can_view_user_detail(): void
    {
        $seller = $this->createSeller();
        $profile = SellerProfile::factory()->create(['user_id' => $seller->id]);

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
                'password' => 'password123',
                'role' => 'seller',
                'seller_name' => 'テストショップ',
                'contact_name' => 'テスト太郎',
                'seller_phone' => '03-1234-5678',
                'seller_email' => 'testseller@example.com',
                'postal_code' => '100-0001',
                'prefecture' => '東京都',
                'city' => '千代田区',
                'address_line1' => '1-1-1',
                'bank_name' => 'テスト銀行',
                'bank_branch' => 'テスト支店',
                'account_type' => 'savings',
                'account_number' => '1234567',
                'account_holder' => 'テスト太郎',
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
                'password' => 'password123',
                'role' => 'participant',
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

        $this->assertDatabaseMissing('users', [
            'id' => $buyer->id,
        ]);
    }

    public function test_user_creation_requires_email(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/users', [
                'name' => 'テストユーザー',
                'password' => 'password123',
                'role' => 'participant',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_user_creation_requires_unique_email(): void
    {
        User::factory()->create(['email' => 'existing@example.com']);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/users', [
                'name' => 'テストユーザー',
                'email' => 'existing@example.com',
                'password' => 'password123',
                'role' => 'participant',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_non_admin_cannot_list_users(): void
    {
        $seller = $this->createSeller();

        $response = $this->actingAs($seller, 'sanctum')
            ->getJson('/api/admin/sellers');

        $response->assertStatus(403);
    }
}
