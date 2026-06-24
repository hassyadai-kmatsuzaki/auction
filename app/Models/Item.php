<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class Item extends BaseModel
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
        'exhibit_code',
        'exhibit_code_issued_at',
        'seller_display_order',
        'species_name',
        'species_type_id',
        'quantity',
        'quantity_unit',
        'sex',
        'parent_fish_info',
        'breeding_environment',
        'start_price',
        'current_price',
        'reserve_price',      // @deprecated フロントエンドで未使用。DB互換のため残存。
        'estimated_price',    // @deprecated フロントエンドで未使用。DB互換のため残存。
        'bid_increment',      // @deprecated フロントエンドで未使用。実際の価格上昇はAuction::calculatePriceIncrement()で計算。
        'inspection_info',
        'individual_info',
        'notes',
        'is_premium',
        'premium_fee',
        'is_anonymous',
        'thumbnail_path',
        'thumbnail_is_manual',
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
        'seller_display_order' => 'integer',
        'is_premium' => 'boolean',
        'is_anonymous' => 'boolean',
        'thumbnail_is_manual' => 'boolean',
        'live_started_at' => 'datetime',
        'live_ended_at' => 'datetime',
        'exhibit_code_issued_at' => 'datetime',
        'parent_fish_info' => 'array',
        'breeding_environment' => 'array',
    ];

    /**
     * 動画URLがサムネイルに設定されてしまっている場合は無視する
     * （`items:fix-video-thumbnails` コマンドで DB クリーンアップ可能）
     */
    public function getThumbnailPathAttribute($value): ?string
    {
        if (! $value) return null;
        if (preg_match('/\.(mp4|mov|webm|m4v)(\?|#|$)/i', $value)) {
            return null;
        }
        return $value;
    }

    /**
     * オークションとのリレーション
     */
    public function auction()
    {
        return $this->belongsTo(Auction::class);
    }

    public function speciesType()
    {
        return $this->belongsTo(SpeciesType::class);
    }

    /**
     * 出品者プロファイルとのリレーション
     */
    public function sellerProfile()
    {
        return $this->belongsTo(SellerProfile::class);
    }

    /**
     * 出品者ユーザー（sellerProfile 経由）
     */
    public function seller()
    {
        return $this->hasOneThrough(
            User::class,
            SellerProfile::class,
            'id',
            'id',
            'seller_profile_id',
            'user_id'
        );
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
                    ->withPivot(['sequence_order', 'started_at', 'finished_at'])
                    ->withTimestamps();
    }

    public function favorites()
    {
        return $this->hasMany(Favorite::class);
    }

    public function pedigreeCertificate()
    {
        return $this->hasOne(PedigreeCertificate::class);
    }

    public function imageAnalysis()
    {
        return $this->hasOne(AIImageAnalysis::class)->latestOfMany();
    }

    public function pricePrediction()
    {
        return $this->hasOne(AIPricePrediction::class)->latestOfMany();
    }
}
