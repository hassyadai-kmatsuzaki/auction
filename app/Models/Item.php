<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Item extends Model
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
        'item_number',
        'species_name',
        'quantity',
        'start_price',
        'current_price',
        'reserve_price',
        'estimated_price',
        'bid_increment',
        'inspection_info',
        'individual_info',
        'notes',
        'is_premium',
        'premium_fee',
        'thumbnail_path',
        'status',
        'unsold_action',
        'storage_fee',
        'live_started_at',
        'live_ended_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'quantity' => 'integer',
        'is_premium' => 'boolean',
        'live_started_at' => 'datetime',
        'live_ended_at' => 'datetime',
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
     * 入札とのリレーション
     */
    public function bids()
    {
        return $this->hasMany(Bid::class);
    }

    /**
     * 落札情報とのリレーション
     */
    public function wonItem()
    {
        return $this->hasOne(WonItem::class);
    }

    /**
     * メディアファイルとのリレーション
     */
    public function media()
    {
        return $this->hasMany(ItemMedia::class);
    }

    /**
     * レーンとのリレーション（多対多）
     */
    public function lanes()
    {
        return $this->belongsToMany(Lane::class, 'lane_items')
                    ->withPivot(['sequence', 'status'])
                    ->withTimestamps();
    }
}
