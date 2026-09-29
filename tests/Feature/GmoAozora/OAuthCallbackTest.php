<?php

namespace Tests\Feature\GmoAozora;

use App\Models\GmoAozoraToken;
use App\Services\GmoAozora\GmoAozoraOAuthService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class OAuthCallbackTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'app.frontend_url' => 'https://staging.medaka-ichiba.com',
            'services.gmo_aozora.environment'   => 'development',
            'services.gmo_aozora.client_id'     => 'cid',
            'services.gmo_aozora.client_secret' => 'csecret',
            'services.gmo_aozora.redirect_uri'  => 'https://staging.medaka-ichiba.com/api/gmo-aozora/oauth/callback',
        ]);
    }

    public function test_valid_callback_exchanges_code_and_stores_token(): void
    {
        Http::fake([
            'https://stg-api.gmo-aozora.com/ganb/api/auth/v1/token' => Http::response([
                'access_token' => 'A1', 'refresh_token' => 'R1', 'scope' => 'private:account private:virtual-account',
                'token_type' => 'Bearer', 'expires_in' => 2592000,
            ]),
        ]);
        $state = app(GmoAozoraOAuthService::class)->buildAuthorizationUrl()['state'];

        $res = $this->get('/api/gmo-aozora/oauth/callback?code=CODE1&state=' . $state);
        $res->assertRedirect('https://staging.medaka-ichiba.com/admin/settings?gmo_aozora=connected');

        Http::assertSent(fn ($req) => $req['grant_type'] === 'authorization_code' && $req['code'] === 'CODE1'
            && $req['redirect_uri'] === config('services.gmo_aozora.redirect_uri')
            && $req->hasHeader('Authorization', 'Basic ' . base64_encode('cid:csecret')));

        $t = GmoAozoraToken::where('environment', 'development')->first();
        $this->assertNotNull($t);
        $this->assertSame('A1', $t->access_token);
        $this->assertNotNull($t->authorized_at);
    }

    public function test_invalid_state_is_rejected(): void
    {
        Http::fake();
        $this->get('/api/gmo-aozora/oauth/callback?code=CODE1&state=bogus')
            ->assertRedirect('https://staging.medaka-ichiba.com/admin/settings?gmo_aozora=error&reason=invalid_state');
        Http::assertNothingSent();
        $this->assertDatabaseCount('gmo_aozora_tokens', 0);
    }

    public function test_access_denied_redirects_with_reason(): void
    {
        Http::fake();
        $state = app(GmoAozoraOAuthService::class)->buildAuthorizationUrl()['state'];
        $this->get('/api/gmo-aozora/oauth/callback?error=access_denied&state=' . $state)
            ->assertRedirect('https://staging.medaka-ichiba.com/admin/settings?gmo_aozora=error&reason=access_denied');
        Http::assertNothingSent();
    }

    public function test_admin_oauth_start_returns_url(): void
    {
        $admin = $this->createAdmin();
        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/gmo-aozora/oauth/start');
        $res->assertStatus(200);
        $this->assertStringStartsWith('https://stg-api.gmo-aozora.com/ganb/api/auth/v1/authorization?', $res->json('data.url'));

        $status = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/gmo-aozora/status');
        $status->assertStatus(200)->assertJsonPath('data.configured', true)->assertJsonPath('data.token', null);
    }
}
