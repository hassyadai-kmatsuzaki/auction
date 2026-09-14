<?php

namespace Tests\Feature\Auth;

use App\Http\Middleware\RateLimitByIp;
use App\Models\SystemSetting;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * R1 (2026-09-14): 認証 API のレート制限「アカウント単位 + 送信元 IP の天井」。
 *
 * 9/20 は参加者 500 名が会場の 1 回線（同じ送信元 IP）から来る。
 * 旧仕様（IP ごと 1 分 10 回）では 11 人目から 429 になったので、
 * 総当たりの守りはアカウント単位に移し、IP 単位は同じ回線の人数を許す天井にした。
 */
class RateLimitByIpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // 設定キー指定（認証系と同じ）と数値指定（webhooks と同じ）の 2 経路を、DB に依存しない形で用意する
        Route::post('/_rl/auth', fn () => response()->json(['ok' => true]))
            ->middleware('rate.limit:auth_rate_limit_per_minute,1');
        Route::post('/_rl/fixed', fn () => response()->json(['ok' => true]))
            ->middleware('rate.limit:2,1');
    }

    private function setLimits(int $perAccount, ?int $perIp = null): void
    {
        SystemSetting::updateOrCreate(
            ['setting_key' => 'auth_rate_limit_per_minute'],
            ['setting_value' => (string) $perAccount, 'value_type' => 'integer', 'category' => 'live_operation',
             'display_name' => 'acct', 'description' => '', 'is_public' => false]
        );
        if ($perIp !== null) {
            SystemSetting::updateOrCreate(
                ['setting_key' => RateLimitByIp::IP_CEILING_KEY],
                ['setting_value' => (string) $perIp, 'value_type' => 'integer', 'category' => 'live_operation',
                 'display_name' => 'ip', 'description' => '', 'is_public' => false]
            );
        }
        SystemSetting::clearCache();
    }

    private function postAs(string $ip, string $uri, array $body): \Illuminate\Testing\TestResponse
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $ip])->postJson($uri, $body);
    }

    /** 同じ回線から別々のアカウントが何人来ても、アカウント別上限（10）には掛からない */
    public function test_many_accounts_from_one_ip_are_not_blocked_by_account_limit(): void
    {
        $this->setLimits(10, 600);

        for ($i = 1; $i <= 30; $i++) {
            $this->postAs('203.0.113.10', '/_rl/auth', ['email' => "user{$i}@example.com", 'password' => 'x'])
                ->assertStatus(200);
        }
    }

    /** 同じアカウントは送信元が違っても合算され、上限の次で 429 */
    public function test_same_account_is_limited_across_ips(): void
    {
        $this->setLimits(3, 600);

        $this->postAs('203.0.113.10', '/_rl/auth', ['email' => 'Target@Example.com', 'password' => 'x'])->assertStatus(200);
        $this->postAs('203.0.113.11', '/_rl/auth', ['email' => 'target@example.com ', 'password' => 'x'])->assertStatus(200);
        $this->postAs('203.0.113.12', '/_rl/auth', ['email' => ' target@example.com', 'password' => 'x'])->assertStatus(200);

        $this->postAs('203.0.113.13', '/_rl/auth', ['email' => 'target@example.com', 'password' => 'x'])
            ->assertStatus(429)
            ->assertJsonPath('success', false);

        // 別アカウントは影響を受けない
        $this->postAs('203.0.113.13', '/_rl/auth', ['email' => 'other@example.com', 'password' => 'x'])->assertStatus(200);
    }

    /** 回線別上限（天井）は別アカウントでも合算され、超えたら 429 */
    public function test_ip_ceiling_applies_across_accounts(): void
    {
        // 天井はアカウント別を下回らないので、アカウント別 2・回線別 3 で試す
        $this->setLimits(2, 3);

        for ($i = 1; $i <= 3; $i++) {
            $this->postAs('203.0.113.20', '/_rl/auth', ['email' => "u{$i}@example.com", 'password' => 'x'])->assertStatus(200);
        }
        $this->postAs('203.0.113.20', '/_rl/auth', ['email' => 'u4@example.com', 'password' => 'x'])->assertStatus(429);

        // 別の送信元は通る
        $this->postAs('203.0.113.21', '/_rl/auth', ['email' => 'u5@example.com', 'password' => 'x'])->assertStatus(200);
    }

    /** 回線別上限はアカウント別上限を下回らない（誤設定でアカウント別より厳しくならない） */
    public function test_ip_ceiling_never_goes_below_account_limit(): void
    {
        $this->setLimits(5, 1);

        for ($i = 1; $i <= 5; $i++) {
            $this->postAs('203.0.113.30', '/_rl/auth', ['email' => "v{$i}@example.com", 'password' => 'x'])->assertStatus(200);
        }
        $this->postAs('203.0.113.30', '/_rl/auth', ['email' => 'v6@example.com', 'password' => 'x'])->assertStatus(429);
    }

    /** アカウント項目が無い要求（Google OAuth など）は回線別上限だけで見る */
    public function test_requests_without_account_field_use_ip_ceiling_only(): void
    {
        $this->setLimits(1, 3);

        for ($i = 1; $i <= 3; $i++) {
            $this->postAs('203.0.113.40', '/_rl/auth', [])->assertStatus(200);
        }
        $this->postAs('203.0.113.40', '/_rl/auth', [])->assertStatus(429);
    }

    /** token / user_id もアカウント項目として扱う（招待トークン・二段階認証） */
    public function test_token_and_user_id_are_account_fields(): void
    {
        $this->setLimits(2, 600);

        $this->postAs('203.0.113.50', '/_rl/auth', ['token' => 'abc'])->assertStatus(200);
        $this->postAs('203.0.113.50', '/_rl/auth', ['token' => 'abc'])->assertStatus(200);
        $this->postAs('203.0.113.50', '/_rl/auth', ['token' => 'abc'])->assertStatus(429);
        $this->postAs('203.0.113.50', '/_rl/auth', ['token' => 'xyz'])->assertStatus(200);

        $this->postAs('203.0.113.50', '/_rl/auth', ['user_id' => 7, 'code' => '000000'])->assertStatus(200);
        $this->postAs('203.0.113.50', '/_rl/auth', ['user_id' => '7', 'code' => '000000'])->assertStatus(200);
        $this->postAs('203.0.113.50', '/_rl/auth', ['user_id' => 7, 'code' => '000000'])->assertStatus(429);
    }

    /** 設定が無いときの既定値: アカウント別 10、回線別 600 */
    public function test_defaults_when_settings_are_missing(): void
    {
        SystemSetting::query()->whereIn('setting_key', ['auth_rate_limit_per_minute', RateLimitByIp::IP_CEILING_KEY])->delete();
        SystemSetting::clearCache();

        for ($i = 1; $i <= 10; $i++) {
            $this->postAs('203.0.113.60', '/_rl/auth', ['email' => 'd@example.com'])->assertStatus(200);
        }
        $this->postAs('203.0.113.60', '/_rl/auth', ['email' => 'd@example.com'])
            ->assertStatus(429);

        // 別アカウントは 11 人目でも通る（旧仕様なら 429 だった）
        $this->postAs('203.0.113.60', '/_rl/auth', ['email' => 'e@example.com'])
            ->assertStatus(200)
            ->assertHeader('X-RateLimit-Limit', '10');
    }

    /** 数値指定（webhooks）は従来どおり送信元 IP だけで数える */
    public function test_numeric_limit_keeps_ip_only_behaviour(): void
    {
        $this->postAs('203.0.113.70', '/_rl/fixed', ['email' => 'a@example.com'])->assertStatus(200);
        $this->postAs('203.0.113.70', '/_rl/fixed', ['email' => 'b@example.com'])->assertStatus(200)
            ->assertHeader('X-RateLimit-Remaining', '0');
        $this->postAs('203.0.113.70', '/_rl/fixed', ['email' => 'c@example.com'])->assertStatus(429);
        $this->postAs('203.0.113.71', '/_rl/fixed', ['email' => 'c@example.com'])->assertStatus(200);
    }

    /** 実経路: /api/auth/login を同じ回線から 11 アカウント分叩いても 429 にならない */
    public function test_real_login_route_allows_eleven_accounts_from_one_ip(): void
    {
        $this->seedRoles();

        for ($i = 1; $i <= 11; $i++) {
            $res = $this->postAs('203.0.113.80', '/api/auth/login', ['email' => "venue{$i}@example.com", 'password' => 'wrong']);
            $this->assertNotSame(429, $res->status(), "{$i} 人目が 429 になった");
        }
    }
}
