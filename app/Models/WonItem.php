<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WonItem extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'item_id',
        'winner_id',
        // 価格情報
        'winning_price',
        'quantity',
        'total_amount',
        'commission_rate',
        'commission_amount',
        'seller_amount',
        // 支払い情報
        'payment_status',
        'payment_method',
        'paid_at',
        'payment_confirmed_at',
        'payment_deadline',
        // 受取方法
        'delivery_method',
        'pickup_datetime',
        'pickup_timeslot',
        // 発送ステータス
        'delivery_status',
        'shipping_locked_at',
        // 配送先情報
        'shipping_postal_code',
        'shipping_prefecture',
        'shipping_city',
        'shipping_address_line1',
        'shipping_address_line2',
        'shipping_name',
        'shipping_phone',
        // 配送情報
        'shipping_company',
        'tracking_number',
        'shipped_at',
        'delivered_at',
        'notes',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'winning_price' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'commission_rate' => 'decimal:2',
        'commission_amount' => 'decimal:2',
        'seller_amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'payment_confirmed_at' => 'datetime',
        'payment_deadline' => 'datetime',
        'pickup_datetime' => 'datetime',
        'shipping_locked_at' => 'datetime',
        'shipped_at' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    /**
     * 商品とのリレーション
     */
    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    /**
     * 落札者とのリレーション
     */
    public function winner()
    {
        return $this->belongsTo(User::class, 'winner_id');
    }

    /**
     * オークションを取得（itemを経由）
     */
    public function auction()
    {
        return $this->hasOneThrough(
            Auction::class,
            Item::class,
            'id',
            'id',
            'item_id',
            'auction_id'
        );
    }

    /**
     * 配送先が変更可能かどうか
     */
    public function canUpdateShippingAddress(): bool
    {
        return is_null($this->shipping_locked_at);
    }

    /**
     * 配送先をロックする
     */
    public function lockShippingAddress(): void
    {
        if (is_null($this->shipping_locked_at)) {
            $this->update(['shipping_locked_at' => now()]);
        }
    }

    /**
     * 入金確認処理
     */
    public function confirmPayment(): bool
    {
        if ($this->payment_status !== 'paid') {
            return false;
        }

        $this->update([
            'payment_status' => 'confirmed',
            'payment_confirmed_at' => now(),
            'shipping_locked_at' => now(),
        ]);

        return true;
    }

    /**
     * 発送処理
     */
    public function ship(string $company, string $trackingNumber): bool
    {
        if ($this->delivery_status !== 'preparing') {
            return false;
        }

        $this->update([
            'delivery_status' => 'shipped',
            'shipping_company' => $company,
            'tracking_number' => $trackingNumber,
            'shipped_at' => now(),
        ]);

        return true;
    }

    /**
     * 指定ユーザーの落札商品を取得するスコープ
     */
    public function scopeForWinner($query, $userId)
    {
        return $query->where('winner_id', $userId);
    }

    /**
     * 支払い待ちの落札商品を取得するスコープ
     */
    public function scopePending($query)
    {
        return $query->where('payment_status', 'pending');
    }

    /**
     * 発送待ちの落札商品を取得するスコープ
     */
    public function scopeReadyToShip($query)
    {
        return $query->where('payment_status', 'confirmed')
                     ->where('delivery_status', 'preparing');
    }
}
