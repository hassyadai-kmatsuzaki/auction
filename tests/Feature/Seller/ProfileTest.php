<?php

namespace Tests\Feature\Seller;

use App\Models\SellerProfile;
use App\Models\User;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    protected User $seller;
    protected SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $this->seller->id]);
    }

    public function test_seller_can_view_own_profile(): void
    {
        $response = $this->actingAs($this->seller, 'sanctum')
            ->getJson('/api/seller/profile');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'profile' => ['id', 'seller_name', 'seller_code'],
                ],
            ]);
    }

    public function test_seller_can_update_profile(): void
    {
        $response = $this->actingAs($this->seller, 'sanctum')
            ->putJson('/api/seller/profile', [
                'seller_name' => '更新されたショップ名',
                'contact_name' => '更新された担当者名',
                'email' => $this->sellerProfile->email,
                'phone' => $this->sellerProfile->phone,
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('seller_profiles', [
            'id' => $this->sellerProfile->id,
            'seller_name' => '更新されたショップ名',
        ]);
    }

    public function test_seller_can_update_bank_info(): void
    {
        $response = $this->actingAs($this->seller, 'sanctum')
            ->putJson('/api/seller/profile/bank', [
                'bank_name' => '新しい銀行',
                'bank_branch' => '新しい支店',
                'account_type' => 'savings',
                'account_number' => '9999999',
                'account_holder' => 'テスト太郎',
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('seller_profiles', [
            'id' => $this->sellerProfile->id,
            'bank_name' => '新しい銀行',
        ]);
    }

    public function test_non_seller_cannot_access_seller_profile(): void
    {
        $participant = $this->createParticipant();

        $response = $this->actingAs($participant, 'sanctum')
            ->getJson('/api/seller/profile');

        $response->assertStatus(403);
    }

    public function test_unauthenticated_user_cannot_access_profile(): void
    {
        $response = $this->getJson('/api/seller/profile');

        $response->assertStatus(401);
    }

    public function test_seller_can_update_notification_settings(): void
    {
        $response = $this->actingAs($this->seller, 'sanctum')
            ->putJson('/api/seller/profile/notifications', [
                'email_item_sold' => true,
                'email_payment_received' => true,
                'email_settlement' => false,
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_seller_can_update_display_settings(): void
    {
        $response = $this->actingAs($this->seller, 'sanctum')
            ->putJson('/api/seller/profile/display', [
                'show_shop_name' => true,
                'show_contact_info' => false,
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_seller_can_upload_profile_image(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        $file = \Illuminate\Http\UploadedFile::fake()->image('avatar.jpg', 500, 500);

        $response = $this->actingAs($this->seller, 'sanctum')
            ->post('/api/seller/profile/image', ['image' => $file]);

        $response->assertOk();
        $this->sellerProfile->refresh();
        $this->assertNotNull($this->sellerProfile->profile_image_path);
    }

    public function test_seller_image_upload_validates_extension(): void
    {
        $file = \Illuminate\Http\UploadedFile::fake()->create('avatar.exe', 100);

        $this->actingAs($this->seller, 'sanctum')
            ->post('/api/seller/profile/image', ['image' => $file])
            ->assertStatus(422);
    }

    public function test_seller_can_delete_profile_image(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        $this->sellerProfile->update(['profile_image_path' => 'profile-images/test.jpg']);

        $response = $this->actingAs($this->seller, 'sanctum')
            ->deleteJson('/api/seller/profile/image');

        $response->assertOk();
        $this->assertNull($this->sellerProfile->fresh()->profile_image_path);
    }
}
