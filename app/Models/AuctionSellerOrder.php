<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class AuctionSellerOrder extends BaseModel
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'auction_id',
        'seller_profile_id',
        'display_order',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'display_order' => 'integer',
    ];

    /**
     * オークションとのリレーション
     */
    public function auction()
    {
        return $this->belongsTo(Auction::class);
    }

    /**
     * 出品者プロファイルとのリレーション
     */
    public function sellerProfile()
    {
        return $this->belongsTo(SellerProfile::class);
    }

    /**
     * この出品者順序に紐づく生体を取得
     * （auction_id + seller_profile_id で絞り込み）
     */
    public function items()
    {
        return Item::where('auction_id', $this->auction_id)
            ->where('seller_profile_id', $this->seller_profile_id);
    }
}
