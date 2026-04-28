<?php

namespace Tests\Feature\Auth;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * GoogleAuthController の Feature テスト。
 * 外部 HTTP は Http::fake() でスタブ。
 *
 * Note: SocialAuthTest にも Google OAuth の検証は存在するが、
 * このクラスは GoogleAuthController を単独で網羅する観点で追加。
 */
class GoogleAuthTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        config([
            'services.google.client_id' => 'gauth-client-id',
            'services.google.client_secret' => 'gauth-secret',
            'services.google.redirect' => 'http://localhost/api/auth/google/callback',
            'app.frontend_url' => 'http://localhost:5173',
        ]);
    }

    public function test_redirect_returns_google_authorize_url_with_state(): void
    {
        $response = $this->getJson('/api/auth/google/redirect');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['url']]);

        $url = $response->json('data.url');
        $this->assertStringStartsWith('https://accounts.google.com/o/oauth2/v2/auth?', $url);
        $this->assertStringContainsString('client_id=gauth-client-id', $url);
        $this->assertStringContainsString('response_type=code', $url);
        $this->assertStringContainsString('state=', $url);
        $this->assertStringContainsString('scope=', $url);
    }

    public function test_redirect_persists_state_in_cache(): void
    {
        $response = $this->getJson('/api/auth/google/redirect');
        $response->assertOk();

        // URL から state を抽出して Cache に存在することを確認
        parse_str(parse_url($response->json('data.url'), PHP_URL_QUERY), $query);
        $this->assertArrayHasKey('state', $query);
        $this->assertTrue((bool) Cache::get("google_oauth_state:{$query['state']}"));
    }

    public function test_callback_redirects_with_error_when_state_invalid(): void
    {
        $response = $this->get('/api/auth/google/callback?code=somecode&state=does-not-exist');

        $response->assertRedirect();
        $this->assertStringContainsString('error=', $response->headers->get('Location'));
    }

    public function test_callback_redirects_with_error_when_state_missing(): void
    {
        $response = $this->get('/api/auth/google/callback?code=onlycode');

        $response->assertRedirect();
        $this->assertStringContainsString('error=', $response->headers->get('Location'));
    }

    public function test_callback_redirects_with_error_when_code_missing(): void
    {
        $state = 'state-no-code';
        Cache::put("google_oauth_state:{$state}", true, 600);

        $response = $this->get("/api/auth/google/callback?state={$state}");

        $response->assertRedirect();
        $this->assertStringContainsString('error=', $response->headers->get('Location'));
    }

    public function test_callback_creates_pending_user_for_new_email(): void
    {
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'tok-new'], 200),
            'www.googleapis.com/oauth2/v2/userinfo' => Http::response([
                'id' => 'GID_NEW_001',
                'email' => 'brand-new@example.com',
                'name' => 'Brand New',
            ], 200),
        ]);

        $state = 'state-create-new';
        Cache::put("google_oauth_state:{$state}", true, 600);

        $response = $this->get("/api/auth/google/callback?code=okcode&state={$state}");

        $response->assertRedirect();
        $this->assertStringContainsString('google_pending=1', $response->headers->get('Location'));
        $this->assertDatabaseHas('users', [
            'email' => 'brand-new@example.com',
            'google_id' => 'GID_NEW_001',
            'status' => 'pending',
        ]);

        // participant ロールが付与されていること
        $user = User::where('email', 'brand-new@example.com')->first();
        $this->assertNotNull($user);
        $this->assertTrue($user->roles()->where('name', 'participant')->exists());
    }

    public function test_callback_logs_in_existing_approved_user_and_issues_token(): void
    {
        $role = Role::firstOrCreate(['name' => 'participant']);
        $user = User::factory()->create([
            'email' => 'returning@example.com',
            'status' => 'approved',
            'is_active' => true,
            'google_id' => null,
        ]);
        $user->roles()->attach($role->id);

        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'tok-existing'], 200),
            'www.googleapis.com/oauth2/v2/userinfo' => Http::response([
                'id' => 'GID_EXIST_002',
                'email' => 'returning@example.com',
                'name' => 'Returning',
            ], 200),
        ]);

        $state = 'state-existing';
        Cache::put("google_oauth_state:{$state}", true, 600);

        $response = $this->get("/api/auth/google/callback?code=okcode&state={$state}");

        $response->assertRedirect();
        $location = $response->headers->get('Location');
        $this->assertStringContainsString('/auth/google-callback?token=', $location);
        $this->assertSame('GID_EXIST_002', $user->fresh()->google_id);
        $this->assertNotNull($user->fresh()->last_login_at);
    }

    public function test_callback_blocks_inactive_or_suspended_user(): void
    {
        $role = Role::firstOrCreate(['name' => 'participant']);
        $user = User::factory()->create([
            'email' => 'blocked@example.com',
            'status' => 'suspended',
            'is_active' => false,
        ]);
        $user->roles()->attach($role->id);

        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'tok'], 200),
            'www.googleapis.com/oauth2/v2/userinfo' => Http::response([
                'id' => 'GID_BLOCKED',
                'email' => 'blocked@example.com',
                'name' => 'Blocked',
            ], 200),
        ]);

        $state = 'state-blocked';
        Cache::put("google_oauth_state:{$state}", true, 600);

        $response = $this->get("/api/auth/google/callback?code=okcode&state={$state}");

        $response->assertRedirect();
        $this->assertStringContainsString('error=', $response->headers->get('Location'));
    }

    public function test_callback_redirects_with_error_when_token_exchange_fails(): void
    {
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['error' => 'invalid_grant'], 400),
        ]);

        $state = 'state-token-fail';
        Cache::put("google_oauth_state:{$state}", true, 600);

        $response = $this->get("/api/auth/google/callback?code=badcode&state={$state}");

        $response->assertRedirect();
        $this->assertStringContainsString('error=', $response->headers->get('Location'));
        $this->assertDatabaseMissing('users', ['email' => 'should-not-exist@example.com']);
    }

    public function test_callback_redirects_with_error_when_userinfo_fails(): void
    {
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'tok-x'], 200),
            'www.googleapis.com/oauth2/v2/userinfo' => Http::response(['error' => 'unauthorized'], 401),
        ]);

        $state = 'state-userinfo-fail';
        Cache::put("google_oauth_state:{$state}", true, 600);

        $response = $this->get("/api/auth/google/callback?code=okcode&state={$state}");

        $response->assertRedirect();
        $this->assertStringContainsString('error=', $response->headers->get('Location'));
    }

    public function test_callback_redirects_with_error_when_email_missing(): void
    {
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'tok-x'], 200),
            'www.googleapis.com/oauth2/v2/userinfo' => Http::response([
                'id' => 'GID_NO_EMAIL',
                'name' => 'No Email',
            ], 200),
        ]);

        $state = 'state-no-email';
        Cache::put("google_oauth_state:{$state}", true, 600);

        $response = $this->get("/api/auth/google/callback?code=okcode&state={$state}");

        $response->assertRedirect();
        $this->assertStringContainsString('error=', $response->headers->get('Location'));
    }
}
