<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Carbon\Carbon;

class Auction extends BaseModel
{
    use HasFactory, SoftDeletes;

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
        'default_bid_increment',  // @deprecated フロントエンドで未使用。DB互換のため残存。
        'countdown_seconds',      // @deprecated フロントエンドで未使用。bid_countdown_seconds に置き換え済み。
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
        // 開催中（live）は削除不可
        if ($this->status === 'live') {
            return false;
        }

        // 商品（生体）が登録されている場合は削除不可。
        // 出品者の作業を巻き戻さないために、items を先に外してから削除する運用。
        if ($this->items()->exists()) {
            return false;
        }

        return true;
    }

    /**
     * 開始可能かどうか
     */
    public function canStart(): bool
    {
        // 予定状態で、承認済み（registered）の生体が1件以上ある場合のみ開始可能
        return $this->status === 'scheduled' 
            && $this->items()->where('status', 'registered')->count() > 0;
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
     * 金額帯別上昇幅テーブルを取得
     */
    public function getPriceIncrementTiers(): array
    {
        return $this->getAuctionSettings()['price_increment_tiers'] ?? [];
    }

    /**
     * 現在価格に基づいて上昇金額を計算（金額帯別テーブル方式）
     *
     * テーブルが設定されている場合はテーブルから取得、
     * 未設定の場合は従来の rate/min 方式にフォールバック
     */
    public function calculatePriceIncrement(int $currentPrice): int
    {
        $tiers = $this->getPriceIncrementTiers();

        if (!empty($tiers)) {
            foreach ($tiers as $tier) {
                $from = (int) ($tier['from_price'] ?? 0);
                $to   = $tier['to_price'] ?? null;

                if ($currentPrice >= $from && ($to === null || $currentPrice <= $to)) {
                    return (int) ($tier['increment_amount'] ?? 100);
                }
            }
        }

        $rate = $this->getPriceIncrementRate();
        $min  = $this->getPriceIncrementMin();
        return (int) max($currentPrice * ($rate / 100), $min);
    }

    /**
     * 金額帯別カウントダウン秒数テーブルを取得
     */
    public function getCountdownTiers(): array
    {
        return $this->getAuctionSettings()['countdown_tiers'] ?? [];
    }

    /**
     * 現在価格に基づいてカウントダウン秒数を計算（金額帯別テーブル方式）
     *
     * テーブルが設定されている場合はテーブルから取得、
     * 未設定の場合は従来の単一値設定にフォールバック
     *
     * @return array{bid_countdown_seconds: float, freeze_countdown_seconds: float}
     */
    public function calculateCountdownSeconds(float $currentPrice): array
    {
        $tiers = $this->getCountdownTiers();

        if (!empty($tiers)) {
            foreach ($tiers as $tier) {
                $from = (float) ($tier['from_price'] ?? 0);
                $to   = $tier['to_price'] ?? null;

                if ($currentPrice >= $from && ($to === null || $currentPrice <= $to)) {
                    return [
                        'bid_countdown_seconds'    => (float) ($tier['bid_countdown_seconds'] ?? $this->getFallbackBidCountdownSeconds()),
                        'freeze_countdown_seconds' => (float) ($tier['freeze_countdown_seconds'] ?? $this->getFallbackFreezeCountdownSeconds()),
                    ];
                }
            }
        }

        return [
            'bid_countdown_seconds'    => $this->getFallbackBidCountdownSeconds(),
            'freeze_countdown_seconds' => $this->getFallbackFreezeCountdownSeconds(),
        ];
    }

    /**
     * フリーズ（誤タップ防止）カウントダウン秒数を取得（単一値フォールバック）
     */
    public function getFreezeCountdownSeconds(): float
    {
        return $this->getFallbackFreezeCountdownSeconds();
    }

    /**
     * 落札カウントダウン秒数を取得（単一値フォールバック）
     */
    public function getBidCountdownSeconds(): float
    {
        return $this->getFallbackBidCountdownSeconds();
    }

    private function getFallbackBidCountdownSeconds(): float
    {
        return (float) ($this->getAuctionSettings()['bid_countdown_seconds'] ?? 5);
    }

    private function getFallbackFreezeCountdownSeconds(): float
    {
        return (float) ($this->getAuctionSettings()['freeze_countdown_seconds'] ?? 1);
    }

    /**
     * @deprecated フロントエンドで未使用。後方互換のため残存。
     */
    public function getPostSaleDisplaySeconds(): float
    {
        return (float) ($this->getAuctionSettings()['post_sale_display_seconds'] ?? 2);
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

        // ソート（同一値でのページネーション不安定を防ぐため id で二次ソート）
        $sortBy = $filters['sort_by'] ?? 'event_date';
        $sortOrder = $filters['sort_order'] ?? 'desc';
        $query->orderBy($sortBy, $sortOrder)->orderBy('id', 'desc');

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
        return $query->withCount('items')
            ->withCount(['items as registered_items_count' => function ($q) {
                $q->where('status', 'registered');
            }])
            ->withCount(['items as draft_items_count' => function ($q) {
                $q->where('status', 'draft');
            }]);
    }
}
