<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Plan extends BaseModel
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'code',
        'name',
        'description',
        'amount',
        'duration_days',
        'allows_bid',
        'allows_sell',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'amount' => 'integer',
        'duration_days' => 'integer',
        'allows_bid' => 'boolean',
        'allows_sell' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    /**
     * 単発プラン（1Day会員など）か。
     * duration_days が設定されているプランは自動更新の対象外（subscriptions:renew から除外）。
     */
    public function isOneShot(): bool
    {
        return $this->duration_days !== null;
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('sort_order')->orderBy('id');
    }
}
