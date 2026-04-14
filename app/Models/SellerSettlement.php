<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 出品者精算
 *
 * 1オークション × 1出品者プロフィール で1行。
 * 管理者が手動で status / paid_at / payment_method を更新する。
 */
class SellerSettlement extends BaseModel
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_ON_HOLD = 'on_hold';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_PROCESSING,
        self::STATUS_COMPLETED,
        self::STATUS_ON_HOLD,
        self::STATUS_CANCELLED,
    ];

    protected $fillable = [
        'auction_id',
        'seller_profile_id',
        'status',
        'total_sales',
        'total_commission',
        'total_shipping_fee',
        'net_amount',
        'items_count',
        'scheduled_payment_date',
        'paid_at',
        'paid_by',
        'payment_method',
        'transaction_reference',
        'note',
    ];

    protected $casts = [
        'total_sales' => 'decimal:2',
        'total_commission' => 'decimal:2',
        'total_shipping_fee' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'items_count' => 'integer',
        'scheduled_payment_date' => 'datetime',
        'paid_at' => 'datetime',
    ];

    public function auction(): BelongsTo
    {
        return $this->belongsTo(Auction::class);
    }

    public function sellerProfile(): BelongsTo
    {
        return $this->belongsTo(SellerProfile::class);
    }

    public function paidBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    /**
     * 集計値を WonItem 群から再計算して保存する
     */
    public function recalculateTotals(): self
    {
        $rows = WonItem::query()
            ->join('items', 'won_items.item_id', '=', 'items.id')
            ->where('items.auction_id', $this->auction_id)
            ->where('items.seller_profile_id', $this->seller_profile_id)
            ->selectRaw('SUM(won_items.total_amount) as total_sales')
            ->selectRaw('SUM(won_items.commission_amount) as total_commission')
            ->selectRaw('SUM(won_items.seller_amount) as net_amount')
            ->selectRaw('SUM(won_items.shipping_fee) as total_shipping_fee')
            ->selectRaw('COUNT(*) as items_count')
            ->first();

        $this->fill([
            'total_sales' => (float) ($rows->total_sales ?? 0),
            'total_commission' => (float) ($rows->total_commission ?? 0),
            'net_amount' => (float) ($rows->net_amount ?? 0),
            'total_shipping_fee' => (float) ($rows->total_shipping_fee ?? 0),
            'items_count' => (int) ($rows->items_count ?? 0),
        ])->save();

        return $this;
    }
}
