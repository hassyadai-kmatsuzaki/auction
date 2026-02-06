<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class BidParticipant extends BaseModel
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'item_id',
        'user_id',
        'is_active',
        'activated_at',
        'deactivated_at',
        'ip_address',
        'user_agent',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'is_active' => 'boolean',
        'activated_at' => 'datetime',
        'deactivated_at' => 'datetime',
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
     * 入札を有効化（ONボタン）
     */
    public function activate(string $ipAddress = null, string $userAgent = null): bool
    {
        if ($this->is_active) {
            return false;
        }

        $this->update([
            'is_active' => true,
            'activated_at' => now(),
            'deactivated_at' => null,
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
        ]);

        return true;
    }

    /**
     * 入札を無効化（OFFボタン）
     */
    public function deactivate(): bool
    {
        if (!$this->is_active) {
            return false;
        }

        $this->update([
            'is_active' => false,
            'deactivated_at' => now(),
        ]);

        return true;
    }

    /**
     * アクティブな参加者を取得するスコープ
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * 指定アイテムのアクティブな参加者を取得するスコープ
     */
    public function scopeForItem($query, $itemId)
    {
        return $query->where('item_id', $itemId);
    }

    /**
     * 指定ユーザーの参加状況を取得するスコープ
     */
    public function scopeForUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * 入札参加を作成または更新
     *
     * @param int $itemId
     * @param int $userId
     * @param bool $isActive
     * @param string|null $ipAddress
     * @param string|null $userAgent
     * @return BidParticipant
     */
    public static function participate(
        int $itemId,
        int $userId,
        bool $isActive = true,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): BidParticipant {
        return static::updateOrCreate(
            [
                'item_id' => $itemId,
                'user_id' => $userId,
            ],
            [
                'is_active' => $isActive,
                'activated_at' => $isActive ? now() : null,
                'deactivated_at' => $isActive ? null : now(),
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
            ]
        );
    }
}
