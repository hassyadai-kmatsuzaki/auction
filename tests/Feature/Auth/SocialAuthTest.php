<?php

namespace Tests\Feature\Auth;

use App\Models\LineAccount;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Google OAuth / LINE Login の Feature テスト。
 *
 * 外部 HTTP は Http::fake() でスタブ。本物の OAuth 往復までは E2E の責務。
 * ここでは「state の検証 / トークン交換 / ユーザー作成 or 紐付け / 適切なリダイレクト」を確認する。
 */
class SocialAuthTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        config([
            'services.google.client_id' => 'test-client-id',
            'services.google.client_secret' => 'test-secret',
            'services.google.redirect' => 'http://localhost/api/auth/google/callback',
            'services.line.channel_id' => 'test-channel',
            'services.line.channel_secret' => 'test-channel-secret',
            'services.line.redirect_uri' => 'http://localhost/api/auth/line/callback',
            'app.frontend_url' => 'http://localhost:5173',
        ]);
    }

    public function test_google_redirect_returns_oauth_url_with_state(): void
    {
        $response = $this->getJson('/api/auth/google/redirect');

        $response->assertOk()
            ->assertJsonStructure(['data' => ['url']]);
        $url = $response->json('data.url');
        $this->assertStringContainsString('https://accounts.google.com/o/oauth2/v2/auth', $url);
        $this->assertStringContainsString('client_id=test-client-id', $url);
        $this->assertStringContainsString('state=', $url);
    }

    public function test_google_callback_rejects_invalid_state(): void
    {
        $response = $this->get('/api/auth/google/callback?code=abc&state=invalid');

        $response->assertRedirect();
        $location = $response->headers->get('Location');
        $this->assertStringContainsString('error=', $location);
    }

    public function test_google_callback_rejects_missing_code(): void
    {
        $state = 'valid-state-1';
        Cache::put("google_oauth_state:{$state}", true, 600);

        $response = $this->get("/api/auth/google/callback?state={$state}");

        $response->assertRedirect();
        $this->assertStringContainsString('error=', $response->headers->get('Location'));
    }

    public function test_google_callback_creates_new_user_pending(): void
    {
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response([
                'access_token' => 'AT',
            ], 200),
            'www.googleapis.com/oauth2/v2/userinfo' => Http::response([
                'id' => 'GOOGLE_NEWUSER',
                'email' => 'newuser@example.com',
                'name' => 'New Google User',
            ], 200),
        ]);

        $state = 'state-new';
        Cache::put("google_oauth_state:{$state}", true, 600);

        $response = $this->get("/api/auth/google/callback?code=ok&state={$state}");

        $response->assertRedirect();
        $this->assertStringContainsString('google_pending=1', $response->headers->get('Location'));
        $this->assertDatabaseHas('users', [
            'email' => 'newuser@example.com',
            'google_id' => 'GOOGLE_NEWUSER',
            'status' => 'pending',
        ]);
    }

    public function test_google_callback_logs_in_existing_approved_user(): void
    {
        $role = Role::firstOrCreate(['name' => 'participant']);
        $user = User::factory()->create([
            'email' => 'existing@example.com',
            'status' => 'approved',
            'is_active' => true,
        ]);
        $user->roles()->attach($role->id);

        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'AT'], 200),
            'www.googleapis.com/oauth2/v2/userinfo' => Http::response([
                'id' => 'GOOGLE_EXIST',
                'email' => 'existing@example.com',
                'name' => 'Existing',
            ], 200),
        ]);

        $state = 'state-existing';
        Cache::put("google_oauth_state:{$state}", true, 600);

        $response = $this->get("/api/auth/google/callback?code=ok&state={$state}");

        $response->assertRedirect();
        $this->assertStringContainsString('/auth/google-callback?token=', $response->headers->get('Location'));
        $this->assertSame('GOOGLE_EXIST', $user->fresh()->google_id);
    }

    public function test_google_callback_blocks_suspended_user(): void
    {
        $role = Role::firstOrCreate(['name' => 'participant']);
        $user = User::factory()->create([
            'email' => 'suspended@example.com',
            'status' => 'suspended',
            'is_active' => false,
        ]);
        $user->roles()->attach($role->id);

        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'AT'], 200),
            'www.googleapis.com/oauth2/v2/userinfo' => Http::response([
                'id' => 'GOOGLE_SUS',
                'email' => 'suspended@example.com',
                'name' => 'Sus',
            ], 200),
        ]);
        $state = 'state-sus';
        Cache::put("google_oauth_state:{$state}", true, 600);

        $response = $this->get("/api/auth/google/callback?code=ok&state={$state}");

        $response->assertRedirect();
        $this->assertStringContainsString('error=', $response->headers->get('Location'));
    }

    public function test_google_callback_token_exchange_failure(): void
    {
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['error' => 'invalid_grant'], 400),
        ]);
        $state = 'state-fail';
        Cache::put("google_oauth_state:{$state}", true, 600);

        $response = $this->get("/api/auth/google/callback?code=bad&state={$state}");
        $response->assertRedirect();
        $this->assertStringContainsString('error=', $response->headers->get('Location'));
    }

    public function test_line_redirect_requires_authentication(): void
    {
        $this->getJson('/api/line/settings/redirect')->assertStatus(401);
    }

    public function test_line_redirect_returns_url_for_authenticated_user(): void
    {
        $user = $this->createParticipant();
        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/line/settings/redirect');

        $response->assertOk()
            ->assertJsonStructure(['data' => ['url']]);
    }

    public function test_line_status_returns_unlinked_when_no_account(): void
    {
        $user = $this->createParticipant();
        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/line/settings/status');
        $response->assertOk()
            ->assertJsonPath('data.linked', false);
    }

    public function test_line_status_returns_linked_account(): void
    {
        $user = $this->createParticipant();
        LineAccount::create([
            'user_id' => $user->id,
            'line_user_id' => 'U_TEST',
            'display_name' => 'TestLine',
            'is_active' => true,
            'linked_at' => now(),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/line/settings/status');

        $response->assertOk()
            ->assertJsonPath('data.linked', true)
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.display_name', 'TestLine');
    }

    public function test_line_unlink_disables_account(): void
    {
        $user = $this->createParticipant();
        $account = LineAccount::create([
            'user_id' => $user->id,
            'line_user_id' => 'U_TEST',
            'is_active' => true,
            'linked_at' => now(),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->deleteJson('/api/line/settings/unlink');

        $response->assertOk();
        $this->assertFalse((bool) $account->fresh()->is_active);
    }

    public function test_line_callback_redirects_with_error_when_code_missing(): void
    {
        $response = $this->get('/api/auth/line/callback');

        $response->assertRedirect();
        $this->assertStringContainsString('line=error', $response->headers->get('Location'));
    }
}
