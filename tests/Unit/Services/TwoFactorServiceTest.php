<?php

namespace Tests\Unit\Services;

use App\Models\User;
use App\Services\TwoFactorService;
use Tests\TestCase;

/**
 * TwoFactorService の Unit テスト。
 *
 * Feature 側 (TwoFactorAuthTest) はエンドポイント経由の挙動を見るので、
 * ここでは Service 単体メソッドの内部仕様 (Base32 / TOTP / リカバリーコード) を確認する。
 */
class TwoFactorServiceTest extends TestCase
{
    private TwoFactorService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->service = new TwoFactorService();
    }

    public function test_generateSecret_は_Base32形式のシークレットを返す(): void
    {
        $user = $this->createParticipant();

        $result = $this->service->generateSecret($user);

        $this->assertArrayHasKey('secret', $result);
        $this->assertArrayHasKey('qr_code_url', $result);
        $this->assertArrayHasKey('recovery_codes', $result);
        $this->assertSame(32, strlen($result['secret']));
        $this->assertMatchesRegularExpression('/^[A-Z2-7]+$/', $result['secret']);
    }

    public function test_generateSecret_は_暗号化してDBに保存する(): void
    {
        $user = $this->createParticipant();

        $result = $this->service->generateSecret($user);
        $user->refresh();

        $this->assertNotNull($user->two_factor_secret);
        $this->assertNotSame($result['secret'], $user->two_factor_secret, '生のままは保存されない');
        $this->assertSame($result['secret'], decrypt($user->two_factor_secret));
        $this->assertNull($user->two_factor_confirmed_at);
    }

    public function test_generateSecret_は_TOTP_URI形式のQRコードURLを返す(): void
    {
        $user = $this->createParticipant();

        $result = $this->service->generateSecret($user);

        $this->assertStringStartsWith('otpauth://totp/', $result['qr_code_url']);
        $this->assertStringContainsString('secret=' . $result['secret'], $result['qr_code_url']);
        $this->assertStringContainsString(rawurlencode($user->email), $result['qr_code_url']);
        $this->assertStringContainsString('algorithm=SHA1', $result['qr_code_url']);
        $this->assertStringContainsString('digits=6', $result['qr_code_url']);
        $this->assertStringContainsString('period=30', $result['qr_code_url']);
    }

    public function test_generateRecoveryCodes_は_デフォルトで8件のXXXXX形式コードを返す(): void
    {
        $codes = $this->service->generateRecoveryCodes();

        $this->assertCount(8, $codes);
        foreach ($codes as $code) {
            $this->assertMatchesRegularExpression('/^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/', $code);
        }
        // 重複なし
        $this->assertCount(8, array_unique($codes));
    }

    public function test_generateRecoveryCodes_は_件数指定が効く(): void
    {
        $this->assertCount(3, $this->service->generateRecoveryCodes(3));
        $this->assertCount(0, $this->service->generateRecoveryCodes(0));
    }

    public function test_verifyCode_は_secret未設定でfalse(): void
    {
        $user = $this->createParticipant();
        $this->assertFalse($this->service->verifyCode($user, '123456'));
    }

    public function test_verifyCode_は_正しいTOTPで通る(): void
    {
        $user = $this->createParticipant();
        $result = $this->service->generateSecret($user);
        $user->refresh();

        // TwoFactorService と同じ計算で 6桁コードを作成
        $code = $this->generateValidTotpCode($result['secret']);

        $this->assertTrue($this->service->verifyCode($user, $code));
    }

    public function test_verifyCode_は_不正なコードでfalse(): void
    {
        $user = $this->createParticipant();
        $this->service->generateSecret($user);
        $user->refresh();

        $this->assertFalse($this->service->verifyCode($user, '000000'));
    }

    public function test_verifyRecoveryCode_は_リカバリーコード未設定でfalse(): void
    {
        $user = $this->createParticipant();
        $this->assertFalse($this->service->verifyRecoveryCode($user, 'abcde-12345'));
    }

    public function test_verifyRecoveryCode_は_正しいコードで通り使用済みになる(): void
    {
        $user = $this->createParticipant();
        $result = $this->service->generateSecret($user);
        $user->refresh();
        $codes = $result['recovery_codes'];

        $this->assertTrue($this->service->verifyRecoveryCode($user, $codes[0]));

        // 同じコードは2回使えない
        $user->refresh();
        $this->assertFalse($this->service->verifyRecoveryCode($user, $codes[0]));

        // 残りは7件
        $remaining = json_decode(decrypt($user->two_factor_recovery_codes), true);
        $this->assertCount(7, $remaining);
        $this->assertNotContains($codes[0], $remaining);
    }

    public function test_verifyRecoveryCode_は_存在しないコードでfalse(): void
    {
        $user = $this->createParticipant();
        $this->service->generateSecret($user);
        $user->refresh();

        $this->assertFalse($this->service->verifyRecoveryCode($user, 'XXXXX-YYYYY'));
    }

    /**
     * テストヘルパ: TwoFactorService と同じ計算で TOTP を作る
     */
    private function generateValidTotpCode(string $secret): string
    {
        $timeStep = (int) floor(time() / 30);
        $key = $this->base32Decode($secret);
        $time = pack('N*', 0, $timeStep);
        $hash = hash_hmac('sha1', $time, $key, true);
        $offset = ord($hash[strlen($hash) - 1]) & 0xF;
        $code = (
            ((ord($hash[$offset]) & 0x7F) << 24) |
            ((ord($hash[$offset + 1]) & 0xFF) << 16) |
            ((ord($hash[$offset + 2]) & 0xFF) << 8) |
            (ord($hash[$offset + 3]) & 0xFF)
        ) % 1000000;
        return str_pad((string) $code, 6, '0', STR_PAD_LEFT);
    }

    private function base32Decode(string $input): string
    {
        $map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $input = strtoupper(rtrim($input, '='));
        $buffer = 0;
        $bitsLeft = 0;
        $output = '';
        for ($i = 0; $i < strlen($input); $i++) {
            $val = strpos($map, $input[$i]);
            if ($val === false) continue;
            $buffer = ($buffer << 5) | $val;
            $bitsLeft += 5;
            if ($bitsLeft >= 8) {
                $bitsLeft -= 8;
                $output .= chr(($buffer >> $bitsLeft) & 0xFF);
            }
        }
        return $output;
    }
}
