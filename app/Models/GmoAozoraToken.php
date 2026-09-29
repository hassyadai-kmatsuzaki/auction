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
        'scope',
        'token_type',
        'expires_at',
        'authorized_at',
        'refreshed_at',
        'last_error',
    ];

    protected $casts = [
        'access_token'  => 'encrypted',
        'refresh_token' => 'encrypted',
        'expires_at'    => 'datetime',
        'authorized_at' => 'datetime',
        'refreshed_at'  => 'datetime',
    ];

    protected $hidden = ['access_token', 'refresh_token'];

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
