<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Subscription extends BaseModel
{
    use HasFactory;

    public const STATUS_PENDING   = 'pending';
    public const STATUS_ACTIVE    = 'active';
    public const STATUS_PAST_DUE  = 'past_due';
    public const STATUS_CANCELED  = 'canceled';
    public const STATUS_SUSPENDED = 'suspended';

    /**
     * 解約理由（suspended_reason に保存される値のうち、業務フラグとして参照するもの）。
     * 管理者による会員種別切替（1Day → 年会員）の解約マーカー。
     * このマーカーが立っている間は 1Day（単発プラン）の再選択を許さない。
     * 本人が年会費プランを決済すると subscribe() の updateOrCreate が null 上書きして自動で消える。
     */
    public const REASON_SWITCHED_BY_ADMIN = 'switched_by_admin';
    public const REASON_ONE_DAY_EXPIRED   = 'one_day_expired';

    protected $fillable = [
        'user_id',
        'plan_id',
        'square_customer_id',
        'square_card_id',
        'card_brand',
        'card_last4',
        'card_exp_month',
        'card_exp_year',
        'status',
        'current_period_start',
        'current_period_end',
        'canceled_at',
        'suspended_at',
        'suspended_reason',
    ];

    protected $casts = [
        'current_period_start' => 'datetime',
        'current_period_end'   => 'datetime',
        'canceled_at'          => 'datetime',
        'suspended_at'         => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE
            && $this->current_period_end
            && $this->current_period_end->isFuture();
    }

    public function isSuspended(): bool
    {
        return in_array($this->status, [self::STATUS_SUSPENDED, self::STATUS_PAST_DUE], true);
    }

    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    /**
     * 自動更新（再課金）の対象。単発プラン（duration_days あり）は絶対に含めない。
     * ⚠ ここに単発プランが混ざると、1Day会員へ10日ごとに500円が自動再課金される事故になる。
     */
    public function scopeDueForRenewal($query)
    {
        return $query->where('status', self::STATUS_ACTIVE)
                     ->whereNotNull('current_period_end')
                     ->where('current_period_end', '<=', now())
                     ->whereHas('plan', fn ($q) => $q->whereNull('duration_days'));
    }

    /**
     * 期限が切れた単発プラン（1Day会員）。課金せず canceled へ遷移させる対象。
     */
    public function scopeOneShotExpired($query)
    {
        return $query->where('status', self::STATUS_ACTIVE)
                     ->whereNotNull('current_period_end')
                     ->where('current_period_end', '<=', now())
                     ->whereHas('plan', fn ($q) => $q->whereNotNull('duration_days'));
    }

    /**
     * 管理者による会員種別切替で解約された状態か（1Day再選択ブロックのマーカー）。
     */
    public function isSwitchedByAdmin(): bool
    {
        return $this->status === self::STATUS_CANCELED
            && $this->suspended_reason === self::REASON_SWITCHED_BY_ADMIN;
    }
}
