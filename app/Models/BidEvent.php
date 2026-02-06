<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class BidEvent extends BaseModel
{
    use HasFactory;

    /**
     * タイムスタンプは created_at のみ
     */
    public $timestamps = false;
    const CREATED_AT = 'created_at';

    /**
     * イベント種別定数
     */
    const TYPE_JOIN = 'join';
    const TYPE_LEAVE = 'leave';
    const TYPE_PRICE_ACCEPT = 'price_accept';
    const TYPE_AUTO_RAISE = 'auto_raise';
    const TYPE_MANUAL_RAISE = 'manual_raise';
    const TYPE_WIN = 'win';
    const TYPE_LOSE = 'lose';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'item_id',
        'user_id',
        'event_type',
        'price_at_event',
        'metadata',
        'ip_address',
        'user_agent',
        'created_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'price_at_event' => 'decimal:2',
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
     * ユーザーとのリレーション
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * イベントを記録
     *
     * @param int $itemId
     * @param int $userId
     * @param string $eventType
     * @param float|null $priceAtEvent
     * @param array|null $metadata
     * @param string|null $ipAddress
     * @param string|null $userAgent
     * @return BidEvent
     */
    public static function record(
        int $itemId,
        int $userId,
        string $eventType,
        ?float $priceAtEvent = null,
        ?array $metadata = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): BidEvent {
        return static::create([
            'item_id' => $itemId,
            'user_id' => $userId,
            'event_type' => $eventType,
            'price_at_event' => $priceAtEvent,
            'metadata' => $metadata,
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
            'created_at' => now(),
        ]);
    }

    /**
     * 入札参加イベントを記録
     */
    public static function recordJoin(
        int $itemId,
        int $userId,
        float $currentPrice,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): BidEvent {
        return static::record($itemId, $userId, self::TYPE_JOIN, $currentPrice, null, $ipAddress, $userAgent);
    }

    /**
     * 入札離脱イベントを記録
     */
    public static function recordLeave(
        int $itemId,
        int $userId,
        float $currentPrice,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): BidEvent {
        return static::record($itemId, $userId, self::TYPE_LEAVE, $currentPrice, null, $ipAddress, $userAgent);
    }

    /**
     * 落札イベントを記録
     */
    public static function recordWin(
        int $itemId,
        int $userId,
        float $winningPrice
    ): BidEvent {
        return static::record($itemId, $userId, self::TYPE_WIN, $winningPrice);
    }

    /**
     * 落札失敗イベントを記録
     */
    public static function recordLose(
        int $itemId,
        int $userId,
        float $finalPrice
    ): BidEvent {
        return static::record($itemId, $userId, self::TYPE_LOSE, $finalPrice);
    }

    /**
     * 指定アイテムのイベントを取得するスコープ
     */
    public function scopeForItem($query, $itemId)
    {
        return $query->where('item_id', $itemId);
    }

    /**
     * 指定ユーザーのイベントを取得するスコープ
     */
    public function scopeForUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * 指定種別のイベントを取得するスコープ
     */
    public function scopeOfType($query, $eventType)
    {
        return $query->where('event_type', $eventType);
    }
}
