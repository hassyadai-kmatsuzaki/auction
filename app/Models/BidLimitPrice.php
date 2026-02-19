<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class BidLimitPrice extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'item_id',
        'user_id',
        'limit_price',
        'is_triggered',
        'triggered_at',
    ];

    protected $casts = [
        'limit_price'  => 'float',
        'is_triggered' => 'boolean',
        'triggered_at' => 'datetime',
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

    // ─── スコープ ────────────────────────────────────────────────

    public function scopeForItem($query, int $itemId)
    {
        return $query->where('item_id', $itemId);
    }

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    /** 未発動の指値のみ取得 */
    public function scopeNotTriggered($query)
    {
        return $query->where('is_triggered', false);
    }

    // ─── ユーティリティ ──────────────────────────────────────────

    /**
     * 発動済みとしてマーク（楽観的ロック付き）
     *
     * 同時に価格上昇が走った場合でも二重発動を防ぐ。
     * 既に発動済みの場合は何もしない（idempotent）。
     */
    public function markAsTriggered(): bool
    {
        $updated = static::where('id', $this->id)
            ->where('is_triggered', false) // 未発動のレコードのみ更新
            ->update([
                'is_triggered' => true,
                'triggered_at' => now(),
            ]);

        if ($updated > 0) {
            $this->is_triggered = true;
            $this->triggered_at = now();
        }

        return $updated > 0;
    }

    /** 指値リセット（再設定時） */
    public function reset(float $newLimitPrice): void
    {
        $this->update([
            'limit_price'  => $newLimitPrice,
            'is_triggered' => false,
            'triggered_at' => null,
        ]);
    }
}
