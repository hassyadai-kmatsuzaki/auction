<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * 参加者の指値（上限価格）に現在価格が達し、自動で入札オフになったことを通知するイベント
 *
 * ※ user_id を含むが、フロントエンド側で自分のイベントかどうかを判定する
 */
class BidLimitReached implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int    $auctionId,
        public int    $laneId,
        public int    $itemId,
        public int    $userId,
        public float  $currentPrice,
        public float  $limitPrice,
        public string $speciesName = '',
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel("auction.{$this->auctionId}.live"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'bid.limit.reached';
    }

    public function broadcastWith(): array
    {
        return [
            'lane_id'       => $this->laneId,
            'item_id'       => $this->itemId,
            'user_id'       => $this->userId,
            'current_price' => $this->currentPrice,
            'limit_price'   => $this->limitPrice,
            'species_name'  => $this->speciesName,
            'message'       => "¥" . number_format($this->limitPrice) . " の上限に達したため自動的に入札オフになりました",
        ];
    }
}
