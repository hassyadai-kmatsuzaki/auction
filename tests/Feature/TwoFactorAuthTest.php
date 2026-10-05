<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Role;
use App\Services\TwoFactorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TwoFactorAuthTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $role = Role::firstOrCreate(['name' => 'participant', 'display_name' => '参加者']);
        $this->user = User::factory()->create([
            'status' => 'approved',
            'is_active' => true,
        ]);
        $this->user->roles()->attach($role);
    }

    public function test_2fa_setup_returns_qr_code_and_secret(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson('/api/two-factor/setup');

        $response->assertOk()
            ->assertJsonStructure([
                'success',
                'data' => ['qr_code_url', 'secret', 'recovery_codes'],
            ]);

        $this->assertCount(8, $response->json('data.recovery_codes'));
    }

    public function test_2fa_confirm_with_valid_code(): void
    {
        $service = new TwoFactorService();
        $result = $service->generateSecret($this->user);

        // 正しいコードを生成して検証
        $this->user->refresh();
        $secret = decrypt($this->user->two_factor_secret);

        // TwoFactorService の内部メソッドでコードを生成
        $code = $this->generateTotpCode($secret);

        $response = $this->actingAs($this->user)
            ->postJson('/api/two-factor/confirm', ['code' => $code]);

        $response->assertOk();
        $this->assertNotNull($this->user->fresh()->two_factor_confirmed_at);
    }

    public function test_2fa_confirm_with_invalid_code(): void
    {
        $service = new TwoFactorService();
        $service->generateSecret($this->user);

        $response = $this->actingAs($this->user)
            ->postJson('/api/two-factor/confirm', ['code' => '000000']);

        $response->assertStatus(422);
    }

    public function test_login_requires_2fa_when_enabled(): void
    {
        $this->user->update([
            'two_factor_secret' => encrypt('TESTSECRET12345678901234567890AB'),
            'two_factor_confirmed_at' => now(),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => $this->user->email,
            'password' => 'password',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.two_factor_required', true)
            ->assertJsonPath('data.user_id', $this->user->id);
    }

    public function test_login_without_2fa_returns_token(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => $this->user->email,
            'password' => 'password',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['data' => ['token', 'user']]);
    }

    public function test_2fa_status(): void
    {
        $response = $this->actingAs($this->user)
            ->getJson('/api/two-factor/status');

        $response->assertOk()
            ->assertJsonPath('data.enabled', false);
    }

    public function test_2fa_disable_requires_password(): void
    {
        $this->user->update([
            'two_factor_secret' => encrypt('TEST'),
            'two_factor_confirmed_at' => now(),
        ]);

        $response = $this->actingAs($this->user)
            ->deleteJson('/api/two-factor/disable', ['password' => 'wrong']);

        $response->assertStatus(422);
    }

    public function test_2fa_disable_with_correct_password(): void
    {
        // setUp の User の password はファクトリ既定値（'password'）
        $service = new TwoFactorService();
        $service->generateSecret($this->user);
        $this->user->update(['two_factor_confirmed_at' => now()]);

        $response = $this->actingAs($this->user)
            ->deleteJson('/api/two-factor/disable', ['password' => 'password']);

        $response->assertOk();
        $this->assertNull($this->user->fresh()->two_factor_secret);
        $this->assertNull($this->user->fresh()->two_factor_confirmed_at);
    }

    public function test_regenerate_recovery_codes(): void
    {
        $service = new TwoFactorService();
        $service->generateSecret($this->user);
        $this->user->update(['two_factor_confirmed_at' => now()]);

        $response = $this->actingAs($this->user)
            ->postJson('/api/two-factor/recovery-codes');

        $response->assertOk()
            ->assertJsonStructure(['data' => ['recovery_codes']]);
        $this->assertCount(8, $response->json('data.recovery_codes'));
    }

    /** 2FA を有効にしてパスワードでログインし、2段階目用のチャレンジを受け取る */
    private function enable2faAndLogin(): array
    {
        (new TwoFactorService())->generateSecret($this->user);
        $this->user->update(['two_factor_confirmed_at' => now()]);
        $secret = decrypt($this->user->fresh()->two_factor_secret);

        $challenge = $this->postJson('/api/auth/login', [
            'email' => $this->user->email,
            'password' => 'password',
        ])->assertOk()->json('data.two_factor_token');
        $this->assertIsString($challenge);

        return [$secret, $challenge];
    }

    public function test_login_requires_2fa_returns_challenge_token(): void
    {
        [, $challenge] = $this->enable2faAndLogin();

        $this->assertSame(64, strlen($challenge));
    }

    public function test_2fa_verify_with_valid_code(): void
    {
        [$secret, $challenge] = $this->enable2faAndLogin();

        $response = $this->postJson('/api/auth/two-factor/verify', [
            'user_id' => $this->user->id,
            'two_factor_token' => $challenge,
            'code' => $this->generateTotpCode($secret),
        ]);

        $response->assertOk()
            ->assertJsonStructure(['data' => ['token']]);
    }

    public function test_2fa_verify_with_wrong_code_fails(): void
    {
        [, $challenge] = $this->enable2faAndLogin();

        $response = $this->postJson('/api/auth/two-factor/verify', [
            'user_id' => $this->user->id,
            'two_factor_token' => $challenge,
            'code' => '000000',
        ]);

        $response->assertStatus(422);
    }

    public function test_2fa_verify_without_password_step_is_rejected_even_with_valid_code(): void
    {
        // 脆弱性の再発防止: パスワードを通さず user_id と正しいコードだけを送ってもログインできない
        (new TwoFactorService())->generateSecret($this->user);
        $this->user->update(['two_factor_confirmed_at' => now()]);
        $secret = decrypt($this->user->fresh()->two_factor_secret);

        $this->postJson('/api/auth/two-factor/verify', [
            'user_id' => $this->user->id,
            'code' => $this->generateTotpCode($secret),
        ])->assertStatus(422)->assertJsonPath('code', 'TWO_FACTOR_CHALLENGE_EXPIRED');

        $this->postJson('/api/auth/two-factor/verify', [
            'user_id' => $this->user->id,
            'two_factor_token' => str_repeat('a', 64),
            'code' => $this->generateTotpCode($secret),
        ])->assertStatus(422);

        $this->assertSame(0, $this->user->tokens()->count());
    }

    public function test_challenge_of_another_user_cannot_be_used(): void
    {
        [, $challenge] = $this->enable2faAndLogin();
        $victim = User::factory()->create(['status' => 'approved', 'is_active' => true]);
        (new TwoFactorService())->generateSecret($victim);
        $victim->update(['two_factor_confirmed_at' => now()]);

        $this->postJson('/api/auth/two-factor/verify', [
            'user_id' => $victim->id,
            'two_factor_token' => $challenge,
            'code' => $this->generateTotpCode(decrypt($victim->fresh()->two_factor_secret)),
        ])->assertStatus(422)->assertJsonPath('code', 'TWO_FACTOR_CHALLENGE_EXPIRED');

        $this->assertSame(0, $victim->tokens()->count());
    }

    public function test_challenge_is_discarded_after_too_many_wrong_codes(): void
    {
        [$secret, $challenge] = $this->enable2faAndLogin();

        for ($i = 0; $i < TwoFactorService::CHALLENGE_MAX_ATTEMPTS; $i++) {
            $this->postJson('/api/auth/two-factor/verify', [
                'user_id' => $this->user->id,
                'two_factor_token' => $challenge,
                'code' => '000000',
            ])->assertStatus(422);
        }

        // 上限後は正しいコードでも通らない（ログインからやり直し）
        $this->postJson('/api/auth/two-factor/verify', [
            'user_id' => $this->user->id,
            'two_factor_token' => $challenge,
            'code' => $this->generateTotpCode($secret),
        ])->assertStatus(422)->assertJsonPath('code', 'TWO_FACTOR_CHALLENGE_EXPIRED');
    }

    public function test_challenge_is_single_use(): void
    {
        [$secret, $challenge] = $this->enable2faAndLogin();
        $payload = ['user_id' => $this->user->id, 'two_factor_token' => $challenge, 'code' => $this->generateTotpCode($secret), 'force_logout_others' => true];

        $this->postJson('/api/auth/two-factor/verify', $payload)->assertOk();
        $this->postJson('/api/auth/two-factor/verify', $payload)->assertStatus(422);
    }

    public function test_challenge_survives_already_logged_in_confirmation(): void
    {
        // 他端末ログイン中の 409 → 確認モーダル → force_logout_others=true で同じチャレンジを再送できる
        [$secret, $challenge] = $this->enable2faAndLogin();
        $this->user->createToken('auth-token'); // 他端末のログイン

        $this->postJson('/api/auth/two-factor/verify', [
            'user_id' => $this->user->id, 'two_factor_token' => $challenge, 'code' => $this->generateTotpCode($secret),
        ])->assertStatus(409);

        $this->postJson('/api/auth/two-factor/verify', [
            'user_id' => $this->user->id, 'two_factor_token' => $challenge, 'code' => $this->generateTotpCode($secret),
            'force_logout_others' => true,
        ])->assertOk()->assertJsonStructure(['data' => ['token']]);
    }

    public function test_2fa_verify_rejects_suspended_user(): void
    {
        // パスワード入力（1段目）の後に管理画面で停止されたケース。正しいコードでもトークンを出さない
        [$secret, $challenge] = $this->enable2faAndLogin();
        $this->user->update(['status' => 'suspended']);

        $response = $this->postJson('/api/auth/two-factor/verify', [
            'user_id' => $this->user->id,
            'two_factor_token' => $challenge,
            'code' => $this->generateTotpCode($secret),
        ]);

        $response->assertStatus(403)
            ->assertJsonMissingPath('data.token');
        $this->assertSame(0, $this->user->tokens()->count());
    }

    private function generateTotpCode(string $secret): string
    {
        $timeStep = (int) floor(time() / 30);
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $buffer = 0; $bitsLeft = 0; $key = '';
        for ($i = 0; $i < strlen($secret); $i++) {
            $val = strpos($chars, strtoupper($secret[$i]));
            if ($val === false) continue;
            $buffer = ($buffer << 5) | $val;
            $bitsLeft += 5;
            if ($bitsLeft >= 8) { $bitsLeft -= 8; $key .= chr(($buffer >> $bitsLeft) & 0xFF); }
        }
        $time = pack('N*', 0, $timeStep);
        $hash = hash_hmac('sha1', $time, $key, true);
        $offset = ord($hash[strlen($hash) - 1]) & 0xF;
        $code = (((ord($hash[$offset]) & 0x7F) << 24) | ((ord($hash[$offset+1]) & 0xFF) << 16) |
                 ((ord($hash[$offset+2]) & 0xFF) << 8) | (ord($hash[$offset+3]) & 0xFF)) % 1000000;
        return str_pad((string)$code, 6, '0', STR_PAD_LEFT);
    }
}
