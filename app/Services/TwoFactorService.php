<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Str;

class TwoFactorService
{
    /**
     * TOTP秘密鍵を生成しユーザーに保存
     */
    public function generateSecret(User $user): array
    {
        $secret = $this->generateBase32Secret();
        $recoveryCodes = $this->generateRecoveryCodes();

        $user->update([
            'two_factor_secret' => encrypt($secret),
            'two_factor_recovery_codes' => encrypt(json_encode($recoveryCodes)),
            'two_factor_confirmed_at' => null,
        ]);

        $appName = config('app.name', 'メダカオークション');
        $qrCodeUrl = $this->getTotpUri($secret, $user->email, $appName);

        return [
            'secret' => $secret,
            'qr_code_url' => $qrCodeUrl,
            'recovery_codes' => $recoveryCodes,
        ];
    }

    /**
     * TOTPコードを検証
     */
    public function verifyCode(User $user, string $code): bool
    {
        if (!$user->two_factor_secret) {
            return false;
        }

        $secret = decrypt($user->two_factor_secret);

        // 現在の時間窓 ±1 の範囲で検証（30秒のずれを許容）
        for ($offset = -1; $offset <= 1; $offset++) {
            $expectedCode = $this->generateTotpCode($secret, time() + ($offset * 30));
            if (hash_equals($expectedCode, $code)) {
                return true;
            }
        }

        return false;
    }

    /**
     * リカバリーコードでの認証
     */
    public function verifyRecoveryCode(User $user, string $code): bool
    {
        if (!$user->two_factor_recovery_codes) {
            return false;
        }

        $codes = json_decode(decrypt($user->two_factor_recovery_codes), true);

        $index = array_search($code, $codes);

        if ($index === false) {
            return false;
        }

        // 使用済みコードを削除
        unset($codes[$index]);
        $user->update([
            'two_factor_recovery_codes' => encrypt(json_encode(array_values($codes))),
        ]);

        return true;
    }

    /**
     * リカバリーコードを生成
     */
    public function generateRecoveryCodes(int $count = 8): array
    {
        $codes = [];
        for ($i = 0; $i < $count; $i++) {
            $codes[] = Str::random(5) . '-' . Str::random(5);
        }
        return $codes;
    }

    /**
     * Base32エンコードされたシークレットキーを生成
     */
    private function generateBase32Secret(int $length = 32): string
    {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $secret = '';
        for ($i = 0; $i < $length; $i++) {
            $secret .= $chars[random_int(0, 31)];
        }
        return $secret;
    }

    /**
     * TOTP URIを生成（QRコード用）
     */
    private function getTotpUri(string $secret, string $email, string $appName): string
    {
        return sprintf(
            'otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30',
            rawurlencode($appName),
            rawurlencode($email),
            $secret,
            rawurlencode($appName),
        );
    }

    /**
     * TOTP コードを生成（RFC 6238）
     */
    private function generateTotpCode(string $secret, ?int $timestamp = null): string
    {
        $timestamp = $timestamp ?? time();
        $timeStep = (int) floor($timestamp / 30);

        // Base32デコード
        $key = $this->base32Decode($secret);

        // タイムステップを8バイトのバイナリにパック
        $time = pack('N*', 0, $timeStep);

        // HMAC-SHA1
        $hash = hash_hmac('sha1', $time, $key, true);

        // Dynamic Truncation
        $offset = ord($hash[strlen($hash) - 1]) & 0xF;
        $code = (
            ((ord($hash[$offset]) & 0x7F) << 24) |
            ((ord($hash[$offset + 1]) & 0xFF) << 16) |
            ((ord($hash[$offset + 2]) & 0xFF) << 8) |
            (ord($hash[$offset + 3]) & 0xFF)
        ) % 1000000;

        return str_pad((string) $code, 6, '0', STR_PAD_LEFT);
    }

    /**
     * Base32デコード
     */
    private function base32Decode(string $input): string
    {
        $map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $input = strtoupper(rtrim($input, '='));

        $buffer = 0;
        $bitsLeft = 0;
        $output = '';

        for ($i = 0; $i < strlen($input); $i++) {
            $val = strpos($map, $input[$i]);
            if ($val === false) {
                continue;
            }
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
