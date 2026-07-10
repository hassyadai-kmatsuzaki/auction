<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasApiTokens;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'trade_name',
        'company_name',
        'email',
        'password',
        'profile_image_path',
        'phone',
        'postal_code',
        'prefecture',
        'city',
        'address_line1',
        'address_line2',
        'status',
        'approved_at',
        'approved_by',
        'rejected_at',
        'rejected_by',
        'rejection_reason',
        'payment_method_preference',
        'bank_transfer_confirmed_at',
        'intended_plan_code',
        'last_login_at',
        'is_active',
        'email_verified_at',
        'notification_settings',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'two_factor_confirmed_at',
        'google_id',
        'trust_score',
        'review_count',
        'email_bounced_at',
        'email_complained_at',
        'email_opt_out_at',
        'unsubscribe_token',
        'is_test',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'unsubscribe_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'bank_transfer_confirmed_at' => 'datetime',
            'last_login_at' => 'datetime',
            'is_active' => 'boolean',
            'password' => 'hashed',
            'notification_settings' => 'array',
            'two_factor_confirmed_at' => 'datetime',
            'email_bounced_at' => 'datetime',
            'email_complained_at' => 'datetime',
            'email_opt_out_at' => 'datetime',
            'is_test' => 'boolean',
        ];
    }

    /**
     * JSONシリアライズ時にタイムゾーン情報を含めない
     */
    protected function serializeDate(DateTimeInterface $date): string
    {
        return $date->format('Y-m-d\TH:i:s');
    }

    /**
     * プロフィール画像の公開URL（相対パスで返す。フロントは現在のホストで解決する）
     */
    public function getProfileImageUrlAttribute(): ?string
    {
        if (empty($this->profile_image_path)) {
            return null;
        }
        return '/storage/' . ltrim($this->profile_image_path, '/');
    }

    /**
     * デフォルトの通知設定を取得
     */
    public function getDefaultNotificationSettings(): array
    {
        return [
            'email_won_item' => true,
            'email_payment_confirmed' => true,
            'email_shipping' => true,
            'email_new_auction' => true,
            'email_auction_start' => true,
            'email_bid_limit_reached' => true,
        ];
    }

    /**
     * 通知設定を取得（デフォルト値とマージ）
     */
    public function getNotificationSettingsAttribute($value): array
    {
        $default = $this->getDefaultNotificationSettings();
        $settings = is_array($value) ? $value : json_decode($value ?? '{}', true);
        return array_merge($default, $settings ?? []);
    }

    /**
     * ロールとのリレーション
     *
     * @return BelongsToMany
     */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'user_roles')
            ->withPivot(['assigned_at', 'assigned_by'])
            ->withTimestamps();
    }

    /**
     * 出品者プロフィールとのリレーション
     *
     * @return HasOne
     */
    public function sellerProfile(): HasOne
    {
        return $this->hasOne(SellerProfile::class);
    }

    /**
     * お気に入りとのリレーション
     *
     * @return HasMany
     */
    public function favorites(): HasMany
    {
        return $this->hasMany(Favorite::class);
    }

    /**
     * 年会費サブスクリプション
     */
    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class);
    }

    /**
     * 決済履歴
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * 有効なサブスクが存在するか
     */
    public function hasActiveSubscription(): bool
    {
        $subscription = $this->subscription()->with('plan')->first();
        return $subscription !== null && $subscription->isActive();
    }

    /**
     * 落札（入札）が許可されているか（プラン allows_bid + active）
     */
    public function canBid(): bool
    {
        $subscription = $this->subscription()->with('plan')->first();
        return $subscription !== null
            && $subscription->isActive()
            && $subscription->plan
            && $subscription->plan->allows_bid;
    }

    /**
     * 出品が許可されているか（プラン allows_sell + active）
     */
    public function canSell(): bool
    {
        $subscription = $this->subscription()->with('plan')->first();
        return $subscription !== null
            && $subscription->isActive()
            && $subscription->plan
            && $subscription->plan->allows_sell;
    }

    /**
     * お気に入りの商品とのリレーション
     *
     * @return BelongsToMany
     */
    public function favoriteItems(): BelongsToMany
    {
        return $this->belongsToMany(Item::class, 'favorites')
            ->withTimestamps();
    }

    /**
     * 銀行振込モード未確認 (毎ログイン時に振込情報モーダルを表示すべきか)
     */
    public function needsBankTransferReminder(): bool
    {
        return $this->payment_method_preference === 'bank_transfer'
            && $this->bank_transfer_confirmed_at === null;
    }

    /**
     * 特定のロールを持っているかチェック
     *
     * @param string $roleName
     * @return bool
     */
    public function hasRole(string $roleName): bool
    {
        return $this->roles()->where('name', $roleName)->exists();
    }

    /**
     * いずれかのロールを持っているかチェック
     *
     * @param array $roleNames
     * @return bool
     */
    public function hasAnyRole(array $roleNames): bool
    {
        return $this->roles()->whereIn('name', $roleNames)->exists();
    }

    /**
     * すべてのロールを持っているかチェック
     *
     * @param array $roleNames
     * @return bool
     */
    public function hasAllRoles(array $roleNames): bool
    {
        return $this->roles()->whereIn('name', $roleNames)->count() === count($roleNames);
    }

    /**
     * 承認済み(=ログイン可能)ユーザーのみに絞るスコープ。
     * 一斉メール通知の宛先取得など、承認前ユーザーへ送ってはいけない場面で使う。
     */
    public function scopeApproved($query)
    {
        return $query->where('is_active', true)
            ->where('status', 'approved');
    }

    /**
     * バルク配信が可能なユーザーのみに絞るスコープ。
     * バウンス/苦情/opt-out のいずれかが立っていれば除外される。
     * トランザクションメール（パスワードリセット等）はこのスコープを使わない。
     */
    public function scopeMailable($query)
    {
        return $query->whereNull('email_bounced_at')
            ->whereNull('email_complained_at')
            ->whereNull('email_opt_out_at');
    }

    /**
     * バルク配信を受け取れる状態か（個別判定用）。
     */
    public function canReceiveBulkEmail(): bool
    {
        return $this->email_bounced_at === null
            && $this->email_complained_at === null
            && $this->email_opt_out_at === null;
    }

    /**
     * 配信停止リンク用の URL。unsubscribe_token をそのまま埋め込む。
     */
    public function getUnsubscribeUrl(): ?string
    {
        if (empty($this->unsubscribe_token)) {
            return null;
        }
        return rtrim(config('app.url'), '/') . '/unsubscribe/' . $this->unsubscribe_token;
    }
}
