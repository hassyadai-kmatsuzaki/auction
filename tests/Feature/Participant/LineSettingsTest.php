<?php

namespace Tests\Feature\Participant;

use App\Models\LineAccount;
use App\Models\LineNotificationSetting;
use App\Services\LineService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class LineSettingsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Config::set('services.line.messaging_token', 'test-messaging-token');
        Config::set('services.line.login_channel_id', 'test-channel-id');
        Config::set('services.line.login_channel_secret', 'test-channel-secret');
        Config::set('services.line.login_redirect_uri', 'https://example.com/callback');
    }

    public function test_index_returns_default_on_for_all_notification_types(): void
    {
        $user = $this->createParticipant();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/line/settings/notifications');

        $response->assertOk()
            ->assertJsonStructure(['success', 'data' => ['notifications']]);

        $items = $response->json('data.notifications');
        $this->assertNotEmpty($items);
        foreach ($items as $row) {
            $this->assertTrue($row['is_enabled'], "type={$row['type']} should default to true");
        }
    }

    public function test_index_reflects_saved_settings(): void
    {
        $user = $this->createParticipant();
        LineNotificationSetting::create([
            'user_id' => $user->id,
            'notification_type' => 'won_item',
            'is_enabled' => false,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/line/settings/notifications');

        $response->assertOk();
        $items = collect($response->json('data.notifications'));
        $wonItem = $items->firstWhere('type', 'won_item');
        $this->assertFalse($wonItem['is_enabled']);
    }

    public function test_update_saves_notification_preferences(): void
    {
        $user = $this->createParticipant();

        $response = $this->actingAs($user, 'sanctum')
            ->putJson('/api/line/settings/notifications', [
                'settings' => [
                    ['type' => 'won_item', 'is_enabled' => false],
                    ['type' => 'auction_start', 'is_enabled' => true],
                ],
            ]);

        $response->assertOk()->assertJson(['success' => true]);
        $this->assertDatabaseHas('line_notification_settings', [
            'user_id' => $user->id,
            'notification_type' => 'won_item',
            'is_enabled' => false,
        ]);
        $this->assertDatabaseHas('line_notification_settings', [
            'user_id' => $user->id,
            'notification_type' => 'auction_start',
            'is_enabled' => true,
        ]);
    }

    public function test_update_validates_notification_type(): void
    {
        $user = $this->createParticipant();

        $response = $this->actingAs($user, 'sanctum')
            ->putJson('/api/line/settings/notifications', [
                'settings' => [
                    ['type' => 'invalid_type', 'is_enabled' => true],
                ],
            ]);

        $response->assertStatus(422);
    }

    public function test_test_endpoint_requires_active_line_account(): void
    {
        $user = $this->createParticipant();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/line/settings/test', ['type' => 'won_item']);

        $response->assertStatus(400)
            ->assertJsonPath('success', false);
    }

    public function test_test_endpoint_pushes_via_line_when_linked(): void
    {
        $user = $this->createParticipant();
        LineAccount::create([
            'user_id' => $user->id,
            'line_user_id' => 'Utestlineid000000',
            'display_name' => 'tester',
            'is_active' => true,
            'linked_at' => now(),
        ]);

        // LINE Push API をモック
        Http::fake([
            'api.line.me/v2/bot/message/push' => Http::response(['ok' => true], 200),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/line/settings/test', ['type' => 'auction_start']);

        $response->assertOk()->assertJson(['success' => true]);

        Http::assertSent(function ($request) {
            return str_contains($request->url(), 'api.line.me/v2/bot/message/push');
        });
    }

    public function test_test_endpoint_returns_error_when_line_push_fails(): void
    {
        $user = $this->createParticipant();
        LineAccount::create([
            'user_id' => $user->id,
            'line_user_id' => 'Ufailedpush000',
            'display_name' => 'tester',
            'is_active' => true,
            'linked_at' => now(),
        ]);

        // LineService をモックして送信失敗を再現
        $mock = $this->mock(LineService::class);
        $mock->shouldReceive('pushFlex')->andReturn(false);
        $mock->shouldReceive('pushText')->andReturn(false);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/line/settings/test', ['type' => 'won_item']);

        $response->assertStatus(500)
            ->assertJsonPath('success', false);
    }

    public function test_index_requires_authentication(): void
    {
        $response = $this->getJson('/api/line/settings/notifications');
        $response->assertStatus(401);
    }

    public function test_test_endpoint_validates_type(): void
    {
        $user = $this->createParticipant();
        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/line/settings/test', ['type' => 'unknown']);

        $response->assertStatus(422);
    }
}
