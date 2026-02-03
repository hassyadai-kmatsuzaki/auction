<?php

namespace Tests\Feature\Participant;

use App\Models\User;
use Tests\TestCase;

class SettingsTest extends TestCase
{
    protected User $participant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->participant = $this->createParticipant();
    }

    public function test_participant_can_view_settings(): void
    {
        $response = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/participant/settings');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data',
            ]);
    }

    public function test_participant_can_update_profile(): void
    {
        $response = $this->actingAs($this->participant, 'sanctum')
            ->putJson('/api/participant/settings/profile', [
                'name' => '更新された名前',
                'phone' => '090-1234-5678',
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('users', [
            'id' => $this->participant->id,
            'name' => '更新された名前',
        ]);
    }

    public function test_participant_can_update_notification_settings(): void
    {
        $response = $this->actingAs($this->participant, 'sanctum')
            ->putJson('/api/participant/settings/notifications', [
                'notification_settings' => [
                    'new_auction' => true,
                    'bid_result' => true,
                    'payment_reminder' => false,
                ],
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_participant_can_change_password(): void
    {
        $this->participant->update(['password' => bcrypt('oldpassword')]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->putJson('/api/participant/settings/password', [
                'current_password' => 'oldpassword',
                'password' => 'newpassword123',
                'password_confirmation' => 'newpassword123',
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_password_change_requires_correct_current_password(): void
    {
        $this->participant->update(['password' => bcrypt('oldpassword')]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->putJson('/api/participant/settings/password', [
                'current_password' => 'wrongpassword',
                'password' => 'newpassword123',
                'password_confirmation' => 'newpassword123',
            ]);

        $response->assertStatus(422);
    }

    public function test_password_change_requires_confirmation(): void
    {
        $this->participant->update(['password' => bcrypt('oldpassword')]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->putJson('/api/participant/settings/password', [
                'current_password' => 'oldpassword',
                'password' => 'newpassword123',
                'password_confirmation' => 'different',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    public function test_non_participant_cannot_access_participant_settings(): void
    {
        $seller = $this->createSeller();

        $response = $this->actingAs($seller, 'sanctum')
            ->getJson('/api/participant/settings');

        $response->assertStatus(403);
    }

    public function test_unauthenticated_user_cannot_access_settings(): void
    {
        $response = $this->getJson('/api/participant/settings');

        $response->assertStatus(401);
    }
}
