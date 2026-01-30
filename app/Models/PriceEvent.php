<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PriceEvent extends Model
{
    use HasFactory;

    /**
     * タイムスタンプは created_at のみ
     */
    public $timestamps = false;
    const CREATED_AT = 'created_at';

    /**
     * 価格変動理由定数
     */
    const REASON_AUTO_INCREMENT = 'auto_increment';
    const REASON_MANUAL_ADJUSTMENT = 'manual_adjustment';
    const REASON_BID_ACCEPTED = 'bid_accepted';
    const REASON_ITEM_START = 'item_start';
    const REASON_ITEM_SOLD = 'item_sold';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'item_id',
        'old_price',
        'new_price',
        'reason',
        'active_bidder_count',
        'triggered_by',
        'metadata',
        'created_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'old_price' => 'decimal:2',
        'new_price' => 'decimal:2',
        'active_bidder_count' => 'integer',
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * 生体とのリレーション
     */
    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    /**
     * トリガーしたユーザーとのリレーション
     */
    public function triggeredBy()
    {
        return $this->belongsTo(User::class, 'triggered_by');
    }

    /**
     * 価格変動イベントを記録
     *
     * @param int $itemId
     * @param float $oldPrice
     * @param float $newPrice
     * @param string $reason
     * @param int $activeBidderCount
     * @param int|null $triggeredBy
     * @param array|null $metadata
     * @return PriceEvent
     */
    public static function record(
        int $itemId,
        float $oldPrice,
        float $newPrice,
        string $reason,
        int $activeBidderCount = 0,
        ?int $triggeredBy = null,
        ?array $metadata = null
    ): PriceEvent {
        return static::create([
            'item_id' => $itemId,
            'old_price' => $oldPrice,
            'new_price' => $newPrice,
            'reason' => $reason,
            'active_bidder_count' => $activeBidderCount,
            'triggered_by' => $triggeredBy,
            'metadata' => $metadata,
            'created_at' => now(),
        ]);
    }

    /**
     * 自動価格上昇を記録
     */
    public static function recordAutoIncrement(
        int $itemId,
        float $oldPrice,
        float $newPrice,
        int $activeBidderCount
    ): PriceEvent {
        return static::record(
            $itemId,
            $oldPrice,
            $newPrice,
            self::REASON_AUTO_INCREMENT,
            $activeBidderCount
        );
    }

    /**
     * 商品開始を記録
     */
    public static function recordItemStart(int $itemId, float $startPrice): PriceEvent
    {
        return static::record(
            $itemId,
            0,
            $startPrice,
            self::REASON_ITEM_START,
            0
        );
    }

    /**
     * 落札確定を記録
     */
    public static function recordItemSold(
        int $itemId,
        float $finalPrice,
        int $winnerId
    ): PriceEvent {
        return static::record(
            $itemId,
            $finalPrice,
            $finalPrice,
            self::REASON_ITEM_SOLD,
            1,
            $winnerId
        );
    }

    /**
     * 手動調整を記録
     */
    public static function recordManualAdjustment(
        int $itemId,
        float $oldPrice,
        float $newPrice,
        int $adminId,
        ?array $metadata = null
    ): PriceEvent {
        return static::record(
            $itemId,
            $oldPrice,
            $newPrice,
            self::REASON_MANUAL_ADJUSTMENT,
            0,
            $adminId,
            $metadata
        );
    }

    /**
     * 指定アイテムのイベントを取得するスコープ
     */
    public function scopeForItem($query, $itemId)
    {
        return $query->where('item_id', $itemId);
    }

    /**
     * 指定理由のイベントを取得するスコープ
     */
    public function scopeOfReason($query, $reason)
    {
        return $query->where('reason', $reason);
    }

    /**
     * 最新のイベントを取得するスコープ
     */
    public function scopeLatestFirst($query)
    {
        return $query->orderBy('created_at', 'desc');
    }
}
