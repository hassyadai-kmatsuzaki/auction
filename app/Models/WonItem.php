<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class WonItem extends BaseModel
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
        // 配送料金
        'shipping_fee',
        'shipping_fee_auto',
        'shipping_breakdown',
        'calculation_mode',
        'shipping_calculated_at',
        'shipping_approved_at',
        'shipping_approved_by',
        'shipping_adjustment_reason',
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
        'shipping_fee' => 'integer',
        'shipping_fee_auto' => 'integer',
        'shipping_breakdown' => 'array',
        'shipping_approved_at' => 'datetime',
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
        'shipping_calculated_at' => 'datetime',
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
     * 落札者（user は winner のエイリアス・NotificationService 等で使用）
     */
    public function user()
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

    /** 伝票番号の区切り文字（複数登録時は tracking_number にカンマ区切りで保持） */
    public const TRACKING_NUMBER_SEPARATOR = ',';

    /** 1発送単位に登録できる伝票番号の上限（出品者側の伝票登録と同じ） */
    public const MAX_TRACKING_NUMBERS = 10;

    /**
     * 伝票番号を配列で返す（$wonItem->tracking_numbers）。
     */
    public function getTrackingNumbersAttribute(): array
    {
        return self::splitTrackingNumbers($this->tracking_number);
    }

    /**
     * カンマ・改行・読点区切りの伝票番号文字列を trim / 空除去 / 重複除去した配列にする。
     */
    public static function splitTrackingNumbers(?string $raw): array
    {
        if ($raw === null || trim($raw) === '') {
            return [];
        }
        $parts = preg_split('/[,\r\n、]+/u', $raw) ?: [];
        $parts = array_map(fn ($s) => trim((string) $s), $parts);
        $parts = array_filter($parts, fn ($s) => $s !== '');

        return array_values(array_unique($parts));
    }

    /**
     * 伝票番号配列を保存用の文字列にする。空なら null。
     */
    public static function joinTrackingNumbers(array $numbers): ?string
    {
        $normalized = self::splitTrackingNumbers(
            implode(self::TRACKING_NUMBER_SEPARATOR, array_map('strval', array_filter($numbers, 'is_scalar')))
        );

        return $normalized === [] ? null : implode(self::TRACKING_NUMBER_SEPARATOR, $normalized);
    }

    /**
     * 配送業者に応じた追跡 URL。未対応の業者は null。
     */
    public function trackingUrlFor(string $number): ?string
    {
        $company = (string) ($this->shipping_company ?? '');
        $clean = str_replace('-', '', $number);

        if (str_contains($company, 'ヤマト') || str_contains($company, 'クロネコ')) {
            return 'https://member.kms.kuronekoyamato.co.jp/parcel/detail?pno=' . $clean;
        }
        if (str_contains($company, '佐川')) {
            return 'https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=' . $clean;
        }
        if (str_contains($company, '郵便') || str_contains($company, 'ゆうパック')) {
            return 'https://trackings.post.japanpost.jp/services/srv/search/?requestNo1=' . $clean;
        }

        return null;
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
     * 送料承認済みか（落札者側への送料/請求書開示条件）
     */
    public function isShippingApproved(): bool
    {
        return !is_null($this->shipping_approved_at);
    }

    /**
     * 送料を承認した管理者
     */
    public function shippingApprover()
    {
        return $this->belongsTo(User::class, 'shipping_approved_by');
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
