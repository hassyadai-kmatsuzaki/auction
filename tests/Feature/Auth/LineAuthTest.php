<?php

namespace Tests\Feature\Auth;

use App\Models\LineAccount;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class LineAuthTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Config::set('services.line.login_channel_id', 'test-channel-id');
        Config::set('services.line.login_channel_secret', 'test-channel-secret');
        Config::set('services.line.login_redirect_uri', 'https://example.com/callback');
        Config::set('services.line.messaging_token', 'test-messaging-token');
    }

    public function test_redirect_returns_line_authorize_url_with_state(): void
    {
        $user = $this->createParticipant();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/line/settings/redirect');

        $response->assertOk()
            ->assertJsonStructure(['success', 'data' => ['url']]);

        $url = $response->json('data.url');
        $this->assertStringContainsString('access.line.me/oauth2/v2.1/authorize', $url);
        $this->assertStringContainsString('state=', $url);
        $this->assertStringContainsString('client_id=test-channel-id', $url);
    }

    public function test_redirect_requires_authentication(): void
    {
        $response = $this->getJson('/api/line/settings/redirect');
        $response->assertStatus(401);
    }

    public function test_callback_links_line_account_via_token_and_profile_apis(): void
    {
        $user = $this->createParticipant();

        // state を redirect 経由でキャッシュに保存
        $redirectResp = $this->actingAs($user, 'sanctum')->getJson('/api/line/settings/redirect');
        $url = $redirectResp->json('data.url');
        parse_str(parse_url($url, PHP_URL_QUERY), $params);
        $state = $params['state'];

        Http::fake([
            'api.line.me/oauth2/v2.1/token' => Http::response([
                'access_token' => 'fake-access-token',
                'token_type' => 'Bearer',
                'expires_in' => 2592000,
            ], 200),
            'api.line.me/v2/profile' => Http::response([
                'userId' => 'U1234567890abcdef',
                'displayName' => 'テスト太郎',
                'pictureUrl' => 'https://profile.line/p.jpg',
            ], 200),
        ]);

        $response = $this->get('/api/auth/line/callback?code=test-code&state=' . urlencode($state));

        $response->assertStatus(302);
        $this->assertStringContainsString('line=success', $response->headers->get('Location'));

        $this->assertDatabaseHas('line_accounts', [
            'user_id' => $user->id,
            'line_user_id' => 'U1234567890abcdef',
            'display_name' => 'テスト太郎',
            'is_active' => true,
        ]);
    }

    public function test_callback_redirects_with_error_when_code_missing(): void
    {
        $response = $this->get('/api/auth/line/callback?state=somestate');
        $response->assertStatus(302);
        $this->assertStringContainsString('line=error', $response->headers->get('Location'));
    }

    public function test_status_returns_link_information(): void
    {
        $user = $this->createParticipant();
        LineAccount::create([
            'user_id' => $user->id,
            'line_user_id' => 'Uabcdef1234567890',
            'display_name' => '山田 太郎',
            'picture_url' => 'https://example.com/p.jpg',
            'is_active' => true,
            'linked_at' => now(),
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/line/settings/status');

        $response->assertOk()
            ->assertJsonPath('data.linked', true)
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.display_name', '山田 太郎');
    }

    public function test_status_returns_unlinked_when_no_account(): void
    {
        $user = $this->createParticipant();

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/line/settings/status');

        $response->assertOk()
            ->assertJsonPath('data.linked', false)
            ->assertJsonPath('data.is_active', false);
    }

    public function test_unlink_marks_account_inactive_without_deleting(): void
    {
        $user = $this->createParticipant();
        $account = LineAccount::create([
            'user_id' => $user->id,
            'line_user_id' => 'Udeadbeef0000',
            'display_name' => 'foo',
            'is_active' => true,
            'linked_at' => now(),
        ]);

        $response = $this->actingAs($user, 'sanctum')->deleteJson('/api/line/settings/unlink');

        $response->assertOk()->assertJson(['success' => true]);
        $this->assertDatabaseHas('line_accounts', [
            'id' => $account->id,
            'user_id' => $user->id,
            'is_active' => false,
        ]);
    }

    public function test_status_requires_authentication(): void
    {
        $response = $this->getJson('/api/line/settings/status');
        $response->assertStatus(401);
    }

    public function test_unlink_requires_authentication(): void
    {
        $response = $this->deleteJson('/api/line/settings/unlink');
        $response->assertStatus(401);
    }
}
