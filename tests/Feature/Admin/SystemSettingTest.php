<?php

namespace Tests\Feature\Admin;

use App\Models\SystemSetting;
use App\Models\User;
use Tests\TestCase;

class SystemSettingTest extends TestCase
{
    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
    }

    public function test_admin_can_list_settings(): void
    {
        SystemSetting::factory()->count(5)->create();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/settings');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'settings',
                ],
            ]);
    }

    public function test_admin_can_update_settings(): void
    {
        SystemSetting::updateOrCreate(
            ['setting_key' => 'price_increment_rate'],
            [
                'category' => 'auction',
                'setting_value' => '10',
                'value_type' => 'integer',
                'display_name' => '価格増加率',
                'description' => 'テスト用',
                'is_public' => false,
            ]
        );

        $response = $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/admin/settings', [
                'settings' => [
                    'price_increment_rate' => '15',
                ],
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('system_settings', [
            'setting_key' => 'price_increment_rate',
            'setting_value' => '15',
        ]);
    }

    public function test_admin_can_get_settings_by_category(): void
    {
        SystemSetting::factory()->auctionSetting()->count(3)->create();
        SystemSetting::factory()->feeSetting()->count(2)->create();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/settings?category=auction');

        $response->assertStatus(200);
    }

    public function test_non_admin_cannot_update_settings(): void
    {
        $participant = $this->createParticipant();

        $response = $this->actingAs($participant, 'sanctum')
            ->putJson('/api/admin/settings', [
                'settings' => [
                    'price_increment_rate' => '15',
                ],
            ]);

        $response->assertStatus(403);
    }

    public function test_unauthenticated_user_cannot_access_settings(): void
    {
        $response = $this->getJson('/api/admin/settings');

        $response->assertStatus(401);
    }
}
