<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class AuctionSellerShipment extends BaseModel
{
    use HasFactory;

    public const CARRIERS = ['yu_pack', 'sagawa', 'yamato'];

    public const CARRIER_LABELS = [
        'yu_pack' => 'ゆうパック',
        'sagawa'  => '佐川',
        'yamato'  => 'ヤマト',
    ];

    protected $fillable = [
        'auction_id',
        'seller_profile_id',
        'carrier',
        'tracking_number',
    ];

    public function auction()
    {
        return $this->belongsTo(Auction::class);
    }

    public function sellerProfile()
    {
        return $this->belongsTo(SellerProfile::class);
    }
}
