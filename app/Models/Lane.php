<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class Lane extends BaseModel
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'auction_id',
        'lane_number',
        'lane_name',
        'current_item_id',
        'status',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'lane_number' => 'integer',
    ];

    /**
     * B-4 (2026-09-14): レーンが変わったら参加者向けライブ状態の共有キャッシュを捨てる。
     * 現在商品の切替（moveToNextItem / MoveToNextItemAction / StartAuctionAction）と状態変更を拾う。
     * トランザクション内の更新は commit 後に捨てる（commit 前に捨てると、他の要求が旧状態で作り直してしまう）。
     * 一括更新（Lane::where()->update()）はモデルイベントが出ないので、呼び元で forgetSharedState を呼ぶ。
     */
    protected static function booted(): void
    {
        $forget = function (Lane $lane): void {
            $auctionId = (int) $lane->auction_id;
            \Illuminate\Support\Facades\DB::afterCommit(function () use ($auctionId) {
                \App\Services\BidService::forgetSharedState($auctionId);
            });
        };
        static::saved($forget);
        static::deleted($forget);
    }

    /**
     * オークションとのリレーション
     */
    public function auction()
    {
        return $this->belongsTo(Auction::class);
    }

    /**
     * 現在の商品とのリレーション
     */
    public function currentItem()
    {
        return $this->belongsTo(Item::class, 'current_item_id');
    }

    /**
     * レーンに割り当てられた商品とのリレーション
     */
    public function items()
    {
        return $this->belongsToMany(Item::class, 'lane_items')
                    ->withPivot(['sequence_order', 'started_at', 'finished_at'])
                    ->withTimestamps()
                    ->orderBy('lane_items.sequence_order');
    }
}
