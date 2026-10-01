<?php

namespace Tests\Unit\Services\GmoAozora;

use App\Models\GmoAozoraToken;
use App\Services\GmoAozora\GmoAozoraApiException;
use App\Services\GmoAozora\GmoAozoraClient;
use App\Services\GmoAozora\GmoAozoraOAuthService;
use App\Services\GmoAozora\GmoConnectionTestService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * GMOあおぞら API クライアント（Http::fake）: 4スコープ・ヘッダ・送金ガード・トークン更新。
 */
class GmoAozoraClientTest extends TestCase
{
    private const STG = 'https://stg-api.gmo-aozora.com';

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.gmo_aozora.environment'   => 'development',
            'services.gmo_aozora.client_id'     => 'cid',
            'services.gmo_aozora.client_secret' => 'csecret',
            'services.gmo_aozora.redirect_uri'  => 'https://staging.medaka-ichiba.com/api/gmo-aozora/oauth/callback',
            'services.gmo_aozora.transfer_enabled' => false,
            'services.gmo_aozora.refresh_before_days' => 7,
            // 流量制御はテスト速度のため無効化（専用テストでだけ有効にする）
            'services.gmo_aozora.min_interval_ms' => 0,
        ]);
    }

    private function captureApiLog(): string
    {
        $log = sys_get_temp_dir() . '/gmo-api-outbound-' . uniqid() . '.log';
        config(['logging.channels.gmo_aozora_api' => [
            'driver' => 'single', 'path' => $log, 'level' => 'info',
            'tap' => [\App\Logging\PlainJsonFormatter::class],
        ]]);
        return $log;
    }

    public function test_requests_are_throttled_to_min_interval(): void
    {
        $this->token();
        config(['services.gmo_aozora.min_interval_ms' => 300]);
        Http::fake([self::STG . '/*' => Http::response(['accounts' => []])]);
        $client = app(GmoAozoraClient::class);

        $start = microtime(true);
        $client->accounts();
        $client->accounts();
        $client->accounts();
        $elapsed = microtime(true) - $start;

        // 1本目は即時、2本目・3本目はそれぞれ 300ms 待つ
        $this->assertGreaterThanOrEqual(0.58, $elapsed);
        Http::assertSentCount(3);
    }

    public function test_every_outbound_request_is_logged_without_secrets(): void
    {
        $this->token();
        $log = $this->captureApiLog();
        Http::fake([
            self::STG . '/ganb/api/corporation/v1/accounts' => Http::response(['accounts' => [['accountId' => '101011234567', 'accountTypeCode' => '01']]], 200, ['x-request-id' => 'req-1']),
            self::STG . '/ganb/api/corporation/v1/transfer/status*' => Http::response(['errorCode' => 'ERR403', 'errorMessage' => 'insufficient_scope'], 403),
            self::STG . '/*' => Http::response(['count' => '0']),
        ]);

        app(GmoConnectionTestService::class)->run('2026-09-01', '2026-09-24');

        $lines = array_map(fn ($l) => json_decode($l, true), file($log, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES));
        $this->assertCount(5, $lines);
        $this->assertSame(['account', 'transfer', 'bulk-transfer', 'virtual-account', 'virtual-account'], array_column($lines, 'scope'));
        $this->assertSame('outbound', $lines[0]['direction']);
        $this->assertSame('GET', $lines[0]['method']);
        $this->assertSame(self::STG . '/ganb/api/corporation/v1/accounts', $lines[0]['url']);
        $this->assertSame(200, $lines[0]['status']);
        $this->assertSame('req-1', $lines[0]['request_id']);
        $this->assertSame('development', $lines[0]['env']);
        $this->assertArrayHasKey('duration_ms', $lines[0]);
        $this->assertSame(403, $lines[1]['status']);
        $this->assertSame('ERR403', $lines[1]['error_code']);
        $this->assertStringContainsString('queryKeyClass=2', $lines[1]['url']);
        $this->assertSame('POST', $lines[3]['method']);

        $raw = file_get_contents($log);
        $this->assertStringNotContainsString('ACCESS1', $raw);
        $this->assertStringNotContainsString('csecret', $raw);
        @unlink($log);
    }

    public function test_token_requests_are_logged_as_auth_scope(): void
    {
        $this->token(1);
        $log = $this->captureApiLog();
        Http::fake([
            self::STG . '/ganb/api/auth/v1/token' => Http::response(['access_token' => 'ACCESS2', 'refresh_token' => 'REFRESH2', 'expires_in' => 2592000]),
            self::STG . '/*' => Http::response(['accounts' => []]),
        ]);

        app(GmoAozoraClient::class)->accounts();

        $lines = array_map(fn ($l) => json_decode($l, true), file($log, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES));
        $this->assertSame(['auth', 'account'], array_column($lines, 'scope'));
        $this->assertSame('token:refresh_token', $lines[0]['context']);
        $raw = file_get_contents($log);
        $this->assertStringNotContainsString('REFRESH1', $raw);
        $this->assertStringNotContainsString('ACCESS2', $raw);
        @unlink($log);
    }

    public function test_refresh_keeps_previous_access_token_for_webhook_grace(): void
    {
        $this->token(1);
        config(['services.gmo_aozora.previous_token_grace_minutes' => 120]);
        Http::fake([self::STG . '/ganb/api/auth/v1/token' => Http::response(['access_token' => 'ACCESS2', 'refresh_token' => 'REFRESH2', 'expires_in' => 2592000])]);

        $t = app(GmoAozoraOAuthService::class)->refresh();

        $this->assertSame('ACCESS1', $t->previous_access_token);
        $this->assertTrue($t->previous_token_valid_until->between(now()->addMinutes(119), now()->addMinutes(121)));
        $this->assertTrue($t->matchesAccessToken('ACCESS2'));
        $this->assertTrue($t->matchesAccessToken('ACCESS1'));
        $this->assertFalse($t->matchesAccessToken('other'));
        $this->assertFalse($t->matchesAccessToken(''));
    }

    private function token(int $daysUntilExpiry = 30): GmoAozoraToken
    {
        return GmoAozoraToken::create([
            'environment' => 'development',
            'access_token' => 'ACCESS1',
            'refresh_token' => 'REFRESH1',
            'scope' => 'private:account private:transfer private:bulk-transfer private:virtual-account',
            'expires_at' => now()->addDays($daysUntilExpiry),
            'authorized_at' => now(),
        ]);
    }

    public function test_tokens_are_stored_encrypted(): void
    {
        $t = $this->token();
        $raw = \DB::table('gmo_aozora_tokens')->where('id', $t->id)->value('access_token');
        $this->assertNotSame('ACCESS1', $raw);
        $this->assertSame('ACCESS1', $t->fresh()->access_token);
    }

    public function test_connection_test_hits_all_four_scopes_with_access_token_header(): void
    {
        $this->token();
        Http::fake([
            self::STG . '/ganb/api/corporation/v1/accounts' => Http::response([
                'baseDate' => '2026-09-24', 'baseTime' => '10:00:00+09:00',
                'accounts' => [['accountId' => '101011234567', 'accountTypeCode' => '01', 'accountNumber' => '1234567']],
            ]),
            self::STG . '/ganb/api/corporation/v1/transfer/status*'     => Http::response(['count' => '0', 'transferDetails' => []]),
            self::STG . '/ganb/api/corporation/v1/bulktransfer/status*' => Http::response(['count' => '0']),
            self::STG . '/ganb/api/corporation/v1/va/list'              => Http::response(['count' => '1', 'hasNext' => false, 'vAccounts' => [['vaId' => '5021099622']]]),
            self::STG . '/ganb/api/corporation/v1/va/deposit-transactions*' => Http::response(['count' => '0', 'hasNext' => false, 'vaTransactions' => []]),
        ]);

        $result = app(GmoConnectionTestService::class)->run('2026-09-01', '2026-09-24');

        $this->assertTrue($result['ok']);
        $this->assertSame(['private:account', 'private:transfer', 'private:bulk-transfer', 'private:virtual-account', 'private:virtual-account'],
            array_column($result['results'], 'scope'));

        Http::assertSent(fn ($req) => str_ends_with($req->url(), '/accounts') && $req->hasHeader('x-access-token', 'ACCESS1'));
        Http::assertSent(fn ($req) => str_contains($req->url(), '/transfer/status?')
            && $req['accountId'] === '101011234567' && $req['queryKeyClass'] === '2' && $req['dateFrom'] === '2026-09-01');
        Http::assertSent(fn ($req) => str_contains($req->url(), '/bulktransfer/status?') && $req['queryKeyClass'] === '2');
        Http::assertSent(fn ($req) => str_ends_with($req->url(), '/va/list') && $req->method() === 'POST' && $req['raId'] === '101011234567');
        Http::assertSent(fn ($req) => str_contains($req->url(), '/va/deposit-transactions?') && $req['raId'] === '101011234567');
    }

    public function test_connection_test_reports_failed_scope_without_aborting(): void
    {
        $this->token();
        Http::fake([
            self::STG . '/ganb/api/corporation/v1/accounts' => Http::response(['accounts' => [['accountId' => '101011234567', 'accountTypeCode' => '01']]]),
            self::STG . '/ganb/api/corporation/v1/transfer/status*' => Http::response(['errorCode' => 'ERR403', 'errorMessage' => 'insufficient_scope'], 403),
            self::STG . '/*' => Http::response(['count' => '0']),
        ]);

        $result = app(GmoConnectionTestService::class)->run();
        $this->assertFalse($result['ok']);
        $transfer = collect($result['results'])->firstWhere('scope', 'private:transfer');
        $this->assertFalse($transfer['ok']);
        $this->assertSame(403, $transfer['status']);
        $this->assertSame('ERR403', $transfer['error']['error_code']);
        $this->assertTrue(collect($result['results'])->firstWhere('scope', 'private:bulk-transfer')['ok']);
    }

    public function test_transfer_request_is_blocked_unless_enabled(): void
    {
        $this->token();
        Http::fake();
        $client = app(GmoAozoraClient::class);

        try {
            $client->transferRequest(['accountId' => '101011234567', 'transfers' => []]);
            $this->fail('expected exception');
        } catch (GmoAozoraApiException $e) {
            $this->assertSame('TRANSFER_DISABLED', $e->errorCode);
        }
        try {
            $client->bulkTransferRequest(['accountId' => '101011234567']);
            $this->fail('expected exception');
        } catch (GmoAozoraApiException $e) {
            $this->assertSame('TRANSFER_DISABLED', $e->errorCode);
        }
        Http::assertNothingSent();
    }

    public function test_transfer_request_sends_idempotency_key_when_enabled(): void
    {
        $this->token();
        config(['services.gmo_aozora.transfer_enabled' => true]);
        Http::fake([self::STG . '/ganb/api/corporation/v1/transfer/request' => Http::response(['accountId' => '101011234567', 'resultCode' => '2', 'applyNo' => '2026092400000001'], 201)]);

        $res = app(GmoAozoraClient::class)->transferRequest(['accountId' => '101011234567', 'transfers' => [['transferAmount' => '1000']]], 'idem-1');
        $this->assertSame('2026092400000001', $res['applyNo']);
        Http::assertSent(fn ($req) => $req->hasHeader('Idempotency-Key', 'idem-1') && $req->hasHeader('x-access-token', 'ACCESS1'));
    }

    public function test_access_token_is_refreshed_when_near_expiry(): void
    {
        $this->token(3); // 7日前を切っている
        Http::fake([
            self::STG . '/ganb/api/auth/v1/token' => Http::response([
                'access_token' => 'ACCESS2', 'refresh_token' => 'REFRESH2', 'scope' => 'private:account',
                'token_type' => 'Bearer', 'expires_in' => 2592000,
            ]),
            self::STG . '/ganb/api/corporation/v1/accounts' => Http::response(['accounts' => []]),
        ]);

        app(GmoAozoraClient::class)->accounts();

        Http::assertSent(fn ($req) => str_ends_with($req->url(), '/auth/v1/token')
            && $req['grant_type'] === 'refresh_token' && $req['refresh_token'] === 'REFRESH1'
            && $req->hasHeader('Authorization', 'Basic ' . base64_encode('cid:csecret')));
        Http::assertSent(fn ($req) => str_ends_with($req->url(), '/accounts') && $req->hasHeader('x-access-token', 'ACCESS2'));

        $t = GmoAozoraToken::first();
        $this->assertSame('ACCESS2', $t->access_token);
        $this->assertSame('REFRESH2', $t->refresh_token);
        $this->assertNotNull($t->refreshed_at);
        $this->assertTrue($t->expires_at->gt(now()->addDays(29)));
    }

    public function test_refresh_failure_is_recorded(): void
    {
        $t = $this->token(1);
        Http::fake([self::STG . '/ganb/api/auth/v1/token' => Http::response(['error' => 'invalid_grant', 'error_description' => 'expired'], 400)]);

        $this->expectException(GmoAozoraApiException::class);
        try {
            app(GmoAozoraOAuthService::class)->accessToken();
        } finally {
            $this->assertStringContainsString('invalid_grant', (string) $t->fresh()->last_error);
        }
    }

    public function test_authorization_url_contains_required_params_and_state_is_single_use(): void
    {
        $oauth = app(GmoAozoraOAuthService::class);
        $auth = $oauth->buildAuthorizationUrl();

        $this->assertStringStartsWith(self::STG . '/ganb/api/auth/v1/authorization?', $auth['url']);
        parse_str(parse_url($auth['url'], PHP_URL_QUERY), $q);
        $this->assertSame('code', $q['response_type']);
        $this->assertSame('cid', $q['client_id']);
        $this->assertSame($auth['state'], $q['state']);
        $this->assertSame(config('services.gmo_aozora.redirect_uri'), $q['redirect_uri']);
        $this->assertStringContainsString('private:virtual-account', $q['scope']);

        $this->assertTrue($oauth->consumeState($auth['state']));
        $this->assertFalse($oauth->consumeState($auth['state']));
        $this->assertFalse($oauth->consumeState('unknown'));
    }

    public function test_webhook_unsent_list_404_means_empty(): void
    {
        $this->token();
        Http::fake([self::STG . '/ganb/api/webhooks/v1/unsentlist/va-deposit-transaction' => Http::response(['errorCode' => 'X', 'errorMessage' => 'none'], 404)]);
        $this->assertSame(['messages' => []], app(GmoAozoraClient::class)->webhookUnsentList());
        Http::assertSent(fn ($req) => $req->hasHeader('Authorization', 'Basic ' . base64_encode('cid:csecret')));
    }
}
