<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class Seller extends BaseModel
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'user_id',
        'seller_code',
        'seller_name',
        'contact_name',
        'email',
        'phone',
        'postal_code',
        'prefecture',
        'city',
        'address_line1',
        'address_line2',
        'bank_name',
        'bank_branch',
        'account_type',
        'account_number',
        'account_holder',
        'commission_rate',
        'notes',
        'is_active',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * ユーザーとのリレーション
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * 出品商品とのリレーション
     */
    public function items()
    {
        return $this->hasMany(Item::class);
    }

    /**
     * ユーザーIDから出品者を取得、または作成
     *
     * @param User $user
     * @return Seller
     */
    public static function getOrCreateForUser(User $user): Seller
    {
        $seller = self::where('user_id', $user->id)->first();
        
        if (!$seller) {
            $seller = self::create([
                'user_id' => $user->id,
                'seller_code' => 'S' . str_pad($user->id, 6, '0', STR_PAD_LEFT),
                'seller_name' => $user->name,
                'contact_name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone ?? '',
                'is_active' => true,
            ]);
        }
        
        return $seller;
    }
}
