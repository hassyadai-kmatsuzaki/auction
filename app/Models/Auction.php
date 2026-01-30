<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class Auction extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'title',
        'event_date',
        'start_time',
        'end_time',
        'status',
        'description',
        'lane_count',
        'default_bid_increment',
        'countdown_seconds',
        'deposit_required',
        'upload_deadline',
        'payment_deadline_hours',
        'shipping_deadline_hours',
        'created_by',
        // カスタム設定
        'use_custom_settings',
        'custom_auction_settings',
        'custom_fee_settings',
        'custom_shipping_settings',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'event_date' => 'date',
        // start_time, end_time は時刻のみ（HH:mm形式）なのでキャストしない
        'upload_deadline' => 'datetime',
        'deposit_required' => 'boolean',
        'lane_count' => 'integer',
        'countdown_seconds' => 'integer',
        'payment_deadline_hours' => 'integer',
        'shipping_deadline_hours' => 'integer',
        // カスタム設定
        'use_custom_settings' => 'boolean',
        'custom_auction_settings' => 'array',
        'custom_fee_settings' => 'array',
        'custom_shipping_settings' => 'array',
    ];

    /**
     * 作成者とのリレーション
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * 商品とのリレーション
     */
    public function items()
    {
        return $this->hasMany(Item::class);
    }

    /**
     * レーンとのリレーション
     */
    public function lanes()
    {
        return $this->hasMany(Lane::class);
    }

    /**
     * 編集可能かどうか
     */
    public function canEdit(): bool
    {
        return in_array($this->status, ['preparing', 'scheduled']);
    }

    /**
     * 削除可能かどうか
     */
    public function canDelete(): bool
    {
        // 準備中または予定中のみ削除可能
        if (!in_array($this->status, ['preparing', 'scheduled'])) {
            return false;
        }
        
        // 商品が登録されている場合は削除不可
        if ($this->items()->count() > 0) {
            return false;
        }
        
        return true;
    }

    /**
     * 開始可能かどうか
     */
    public function canStart(): bool
    {
        return $this->status === 'scheduled' 
            && $this->items()->count() > 0;
    }

    /**
     * キャンセル可能かどうか
     */
    public function canCancel(): bool
    {
        return in_array($this->status, ['preparing', 'scheduled']);
    }

    /**
     * 終了可能かどうか
     */
    public function canFinish(): bool
    {
        return $this->status === 'live';
    }

    /**
     * オークションを開始
     */
    public function start(): bool
    {
        if (!$this->canStart()) {
            return false;
        }

        $this->update([
            'status' => 'live',
        ]);

        return true;
    }

    /**
     * オークションを終了
     */
    public function finish(): bool
    {
        if (!$this->canFinish()) {
            return false;
        }

        $this->update([
            'status' => 'finished',
            'end_time' => now()->format('H:i:s'),
        ]);

        return true;
    }

    /**
     * オークションをキャンセル
     */
    public function cancel(): bool
    {
        if (!$this->canCancel()) {
            return false;
        }

        $this->update([
            'status' => 'cancelled',
        ]);

        return true;
    }

    /**
     * 開催日時の取得
     */
    public function getEventDateTimeAttribute(): Carbon
    {
        return Carbon::parse($this->event_date->format('Y-m-d') . ' ' . $this->start_time);
    }

    /**
     * オークション設定を取得（カスタム設定またはシステムデフォルト）
     *
     * @return array
     */
    public function getAuctionSettings(): array
    {
        if ($this->use_custom_settings && $this->custom_auction_settings) {
            return array_merge(
                SystemSetting::getAuctionDefaults(),
                $this->custom_auction_settings
            );
        }
        return SystemSetting::getAuctionDefaults();
    }

    /**
     * 料金設定を取得（カスタム設定またはシステムデフォルト）
     *
     * @return array
     */
    public function getFeeSettings(): array
    {
        if ($this->use_custom_settings && $this->custom_fee_settings) {
            return array_merge(
                SystemSetting::getFeeDefaults(),
                $this->custom_fee_settings
            );
        }
        return SystemSetting::getFeeDefaults();
    }

    /**
     * 配送・梱包設定を取得（カスタム設定またはシステムデフォルト）
     *
     * @return array
     */
    public function getShippingSettings(): array
    {
        if ($this->use_custom_settings && $this->custom_shipping_settings) {
            return array_merge(
                SystemSetting::getShippingDefaults(),
                $this->custom_shipping_settings
            );
        }
        return SystemSetting::getShippingDefaults();
    }

    /**
     * すべての設定をまとめて取得
     *
     * @return array
     */
    public function getAllSettings(): array
    {
        return [
            'use_custom_settings' => $this->use_custom_settings,
            'auction_settings' => $this->getAuctionSettings(),
            'fee_settings' => $this->getFeeSettings(),
            'shipping_settings' => $this->getShippingSettings(),
        ];
    }

    /**
     * 価格上昇率を取得
     */
    public function getPriceIncrementRate(): float
    {
        return $this->getAuctionSettings()['price_increment_rate'];
    }

    /**
     * 最低上昇金額を取得
     */
    public function getPriceIncrementMin(): int
    {
        return $this->getAuctionSettings()['price_increment_min'];
    }

    /**
     * 買受者手数料を計算
     *
     * @param float $price 落札金額
     * @return float
     */
    public function calculateBuyerCommission(float $price): float
    {
        $settings = $this->getFeeSettings();
        $commission = $price * ($settings['buyer_commission_rate'] / 100);
        return max($commission, $settings['buyer_commission_min']);
    }

    /**
     * 出品者手数料を計算
     *
     * @param float $price 落札金額
     * @return float
     */
    public function calculateSellerCommission(float $price): float
    {
        $settings = $this->getFeeSettings();
        $commission = $price * ($settings['seller_commission_rate'] / 100);
        return max($commission, $settings['seller_commission_min']);
    }

    /**
     * 管理画面用のオークション一覧を取得するスコープ
     */
    public function scopeForAdmin($query, $filters = [])
    {
        // ステータスフィルター
        if (!empty($filters['status']) && $filters['status'] !== 'all') {
            $query->where('status', $filters['status']);
        }

        // 開催日フィルター
        if (!empty($filters['date_from'])) {
            $query->whereDate('event_date', '>=', $filters['date_from']);
        }
        if (!empty($filters['date_to'])) {
            $query->whereDate('event_date', '<=', $filters['date_to']);
        }

        // ソート
        $sortBy = $filters['sort_by'] ?? 'event_date';
        $sortOrder = $filters['sort_order'] ?? 'desc';
        $query->orderBy($sortBy, $sortOrder);

        return $query;
    }

    /**
     * 開催予定のオークションを開始するスコープ
     */
    public function scopeStartScheduled($query)
    {
        $now = now();
        
        return $query->where('status', 'scheduled')
                     ->whereDate('event_date', $now->toDateString())
                     ->whereTime('start_time', '<=', $now->toTimeString())
                     ->update(['status' => 'live']);
    }

    /**
     * 商品数を含めて取得
     */
    public function scopeWithItemsCount($query)
    {
        return $query->withCount('items');
    }
}
