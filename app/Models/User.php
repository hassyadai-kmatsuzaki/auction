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
            'last_login_at' => 'datetime',
            'is_active' => 'boolean',
            'password' => 'hashed',
            'notification_settings' => 'array',
            'two_factor_confirmed_at' => 'datetime',
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
}
