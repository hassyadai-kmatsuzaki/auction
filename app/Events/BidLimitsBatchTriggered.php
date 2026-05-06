<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * 同一価格変動で複数ユーザーの指値が一括発動したことを通知する集約イベント。
 *
 * 設計意図（実装書 B2/B3）:
 *   - 1 回の adjustPriceByBidLimits で N ユーザー分の BidLimitReached を個別 broadcast
 *     すると、120 接続 × N 件 = N×120 メッセージのフラッシュが発生してフロントが詰まる。
 *   - 本イベントは triggered ユーザーリストを 1 つの payload にまとめて 1 回だけ broadcast。
 *   - 既存 BidLimitReached も並行して emit され続けるため、フロントの段階移行が可能。
 *
 * フロントエンド処理:
 *   - 自分の user_id が triggered[].user_id に含まれていて action='cancelled' の場合のみ
 *     UI に「上限到達で離脱」表示。
 *   - protected=true の場合は表示しない（保護されて active のまま）。
 */
class BidLimitsBatchTriggered implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param array<int, array{user_id:int, limit_price:float, action:string, protected:bool}> $triggered
     *        - action: 'cancelled' (active から離脱) | 'triggered' (元から非active)
     *        - protected: true なら同価格保護で active 維持
     */
    public function __construct(
        public int   $auctionId,
        public int   $laneId,
        public int   $itemId,
        public float $currentPrice,
        public array $triggered,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel("auction.{$this->auctionId}.live"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'bid.limits.batch.triggered';
    }

    public function broadcastWith(): array
    {
        return [
            'lane_id'       => $this->laneId,
            'item_id'       => $this->itemId,
            'current_price' => $this->currentPrice,
            'triggered'     => $this->triggered,
            'count'         => count($this->triggered),
        ];
    }
}
