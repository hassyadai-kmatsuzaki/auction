<?php

namespace App\Models;

/**
 * GMOあおぞら 振込入金口座（落札者専用の振込先）。
 */
class GmoVirtualAccount extends BaseModel
{
    protected $table = 'gmo_virtual_accounts';

    public const STATUS_AVAILABLE = '1';
    public const STATUS_SUSPENDED = '2';
    public const STATUS_DELETED   = '3';

    protected $fillable = [
        'environment',
        'va_id',
        'branch_code',
        'branch_name_kana',
        'account_number',
        'holder_name_kana',
        'va_type_code',
        'status_code',
        'ra_id',
        'expire_at',
        'user_id',
        'assigned_at',
        'last_deposit_at',
        'raw',
    ];

    protected $casts = [
        'expire_at'       => 'datetime',
        'assigned_at'     => 'datetime',
        'last_deposit_at' => 'datetime',
        'raw'             => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function scopeEnvironment($query, ?string $environment = null)
    {
        return $query->where('environment', $environment ?? config('services.gmo_aozora.environment', 'development'));
    }

    public function scopeAvailable($query)
    {
        return $query->where('status_code', self::STATUS_AVAILABLE);
    }

    public function scopeUnassigned($query)
    {
        return $query->whereNull('user_id');
    }

    /**
     * 落札者へ案内する振込先の表示用配列。
     */
    public function toBankInfoArray(): array
    {
        return [
            'bank_name'      => 'GMOあおぞらネット銀行',
            'bank_code'      => '0310',
            'branch_code'    => $this->branch_code,
            'branch_name_kana' => $this->branch_name_kana,
            'account_type'   => '普通',
            'account_number' => $this->account_number,
            'account_holder_kana' => $this->holder_name_kana,
        ];
    }
}
