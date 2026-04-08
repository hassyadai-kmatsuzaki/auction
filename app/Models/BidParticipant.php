<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * BidParticipant（入札参加者）
 *
 * ビジネスロジックは BidParticipantRepository に移行済み。
 * このクラスはエンティティ定義・リレーション・シンプルなアクセサのみを持つ。
 *
 * スコープメソッド（scopeActive, scopeForItem, scopeForUser）は
 * 既存コードとの後方互換性のため残しているが、
 * 新規コードでは BidParticipantRepository を使用すること。
 */
class BidParticipant extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'item_id',
        'user_id',
        'is_active',
        'activated_at',
        'deactivated_at',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'is_active'      => 'boolean',
        'activated_at'   => 'datetime',
        'deactivated_at' => 'datetime',
    ];

    // ─── リレーション ────────────────────────────────────────────

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // ─── アクセサ ────────────────────────────────────────────────

    /** 入札が有効かどうか */
    public function getIsActiveBidAttribute(): bool
    {
        return $this->is_active;
    }

    // ─── シンプルな状態変更（後方互換） ──────────────────────────
    // 新規コードでは BidParticipantRepository::deactivate() を使用すること

    public function activate(?string $ipAddress = null, ?string $userAgent = null): bool
    {
        if ($this->is_active) return false;
        $this->update([
            'is_active'    => true,
            'activated_at' => now(),
            'ip_address'   => $ipAddress,
            'user_agent'   => $userAgent,
        ]);
        return true;
    }

    public function deactivate(): bool
    {
        if (!$this->is_active) return false;
        $this->update(['is_active' => false, 'deactivated_at' => now()]);
        return true;
    }

    // ─── Eloquentスコープ（後方互換） ────────────────────────────
    // 新規コードでは BidParticipantRepository を使用すること

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForItem($query, int $itemId)
    {
        return $query->where('item_id', $itemId);
    }

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    // ─── 静的ファクトリ（後方互換） ──────────────────────────────
    // 新規コードでは BidParticipantRepository::participate() を使用すること

    public static function participate(
        int     $itemId,
        int     $userId,
        bool    $isActive = true,
        ?string $ipAddress = null,
        ?string $userAgent = null,
    ): self {
        // INSERT ... ON DUPLICATE KEY UPDATE でアトミックに処理
        // updateOrCreate() の check-then-act 競合を回避
        static::upsert(
            [
                [
                    'item_id'        => $itemId,
                    'user_id'        => $userId,
                    'is_active'      => $isActive,
                    'activated_at'   => $isActive ? now() : null,
                    'deactivated_at' => $isActive ? null : now(),
                    'ip_address'     => $ipAddress,
                    'user_agent'     => $userAgent,
                    'created_at'     => now(),
                    'updated_at'     => now(),
                ],
            ],
            ['item_id', 'user_id'], // ユニークキー
            ['is_active', 'activated_at', 'deactivated_at', 'ip_address', 'user_agent', 'updated_at'] // 更新カラム
        );

        return static::where('item_id', $itemId)->where('user_id', $userId)->first();
    }
}
