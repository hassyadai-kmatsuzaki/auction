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

    public function test_2fa_verify_with_valid_code(): void
    {
        $service = new TwoFactorService();
        $service->generateSecret($this->user);
        $this->user->update(['two_factor_confirmed_at' => now()]);
        $secret = decrypt($this->user->fresh()->two_factor_secret);
        $code = $this->generateTotpCode($secret);

        $response = $this->postJson('/api/auth/two-factor/verify', [
            'user_id' => $this->user->id,
            'code' => $code,
        ]);

        $response->assertOk()
            ->assertJsonStructure(['data' => ['token']]);
    }

    public function test_2fa_verify_with_wrong_code_fails(): void
    {
        $service = new TwoFactorService();
        $service->generateSecret($this->user);
        $this->user->update(['two_factor_confirmed_at' => now()]);

        $response = $this->postJson('/api/auth/two-factor/verify', [
            'user_id' => $this->user->id,
            'code' => '000000',
        ]);

        $response->assertStatus(422);
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
