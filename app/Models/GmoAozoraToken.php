<?php

namespace App\Models;

use Carbon\Carbon;

/**
 * GMOあおぞら OAuth トークン（環境ごとに1行）。
 *
 * access_token / refresh_token は encrypted キャストで APP_KEY により暗号化される。
 * APP_KEY を変えると復号できなくなるので、その場合は再認可が必要。
 */
class GmoAozoraToken extends BaseModel
{
    protected $table = 'gmo_aozora_tokens';

    protected $fillable = [
        'environment',
        'access_token',
        'refresh_token',
        'previous_access_token',
        'previous_token_valid_until',
        'scope',
        'token_type',
        'expires_at',
        'authorized_at',
        'refreshed_at',
        'last_error',
    ];

    protected $casts = [
        'access_token'          => 'encrypted',
        'refresh_token'         => 'encrypted',
        'previous_access_token' => 'encrypted',
        'previous_token_valid_until' => 'datetime',
        'expires_at'    => 'datetime',
        'authorized_at' => 'datetime',
        'refreshed_at'  => 'datetime',
    ];

    protected $hidden = ['access_token', 'refresh_token', 'previous_access_token'];

    /**
     * Webhook の x-access-token が現行トークン（または猶予期間内の旧トークン）と一致するか。タイミングセーフ比較。
     */
    public function matchesAccessToken(string $presented): bool
    {
        if ($presented === '') {
            return false;
        }
        if (hash_equals((string) $this->access_token, $presented)) {
            return true;
        }
        return $this->previous_access_token !== null
            && $this->previous_token_valid_until !== null
            && $this->previous_token_valid_until->isFuture()
            && hash_equals((string) $this->previous_access_token, $presented);
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    /**
     * 失効まで $days 日を切っているか（リフレッシュ判定）。
     */
    public function expiresWithin(int $days): bool
    {
        return $this->expires_at === null || $this->expires_at->lte(Carbon::now()->addDays($days));
    }

    /**
     * 管理画面/CLI 向けの表示用サマリー（トークン本体は含めない）。
     */
    public function toStatusArray(): array
    {
        return [
            'environment'   => $this->environment,
            'scope'         => $this->scope,
            'expires_at'    => $this->expires_at?->toIso8601String(),
            'expires_in_days' => $this->expires_at ? (int) Carbon::now()->diffInDays($this->expires_at, false) : null,
            'authorized_at' => $this->authorized_at?->toIso8601String(),
            'refreshed_at'  => $this->refreshed_at?->toIso8601String(),
            'last_error'    => $this->last_error,
        ];
    }
}
