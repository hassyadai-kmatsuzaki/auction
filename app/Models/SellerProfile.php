<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SellerProfile extends BaseModel
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'seller_profiles';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'seller_code',
        'seller_name',
        'corporate_name',
        'business_type',
        'business_registration_number',
        'contact_name',
        'email',
        'phone',
        'postal_code',
        'prefecture',
        'city',
        'address_line1',
        'address_line2',
        'instagram',
        'twitter',
        'youtube',
        'website',
        'other_sns',
        'sales_channels',
        'event_history',
        'event_hosting',
        'shop_address',
        'bank_name',
        'bank_branch',
        'account_type',
        'account_number',
        'account_holder',
        'commission_rate',
        'notes',
        'notification_settings',
        'display_settings',
        'is_active',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'is_active' => 'boolean',
        'commission_rate' => 'decimal:2',
        'notification_settings' => 'array',
        'display_settings' => 'array',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'bank_name',
        'bank_branch',
        'account_type',
        'account_number',
        'account_holder',
    ];

    /**
     * ユーザーとのリレーション
     *
     * @return BelongsTo
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * 出品商品とのリレーション
     *
     * @return HasMany
     */
    public function items(): HasMany
    {
        return $this->hasMany(Item::class, 'seller_profile_id');
    }

    /**
     * 口座情報を含めて取得
     */
    public function getWithBankInfo(): array
    {
        return array_merge($this->toArray(), [
            'bank_name' => $this->bank_name,
            'bank_branch' => $this->bank_branch,
            'account_type' => $this->account_type,
            'account_number' => $this->account_number,
            'account_holder' => $this->account_holder,
        ]);
    }
}
