<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PriceUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $auctionId;
    public int $laneId;
    public int $itemId;
    public float $newPrice;
    public int $activeBiddersCount;
    /**
     * tier テーブルで小数秒（例: 5.5）を許容するため float。
     * 旧版は int 宣言で silent 切り捨て → 5.5 が 5 として届く事故あり。
     */
    public float $countdownSeconds;
    public array $autoLeftUserIds;

    public function __construct(
        int $auctionId,
        int $laneId,
        int $itemId,
        float $newPrice,
        int $activeBiddersCount,
        float $countdownSeconds,
        array $autoLeftUserIds = []
    ) {
        $this->auctionId = $auctionId;
        $this->laneId = $laneId;
        $this->itemId = $itemId;
        $this->newPrice = $newPrice;
        $this->activeBiddersCount = $activeBiddersCount;
        $this->countdownSeconds = $countdownSeconds;
        $this->autoLeftUserIds = $autoLeftUserIds;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel('auction.' . $this->auctionId . '.live'),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'price.updated';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'item_id' => $this->itemId,
            'lane_id' => $this->laneId,
            'new_price' => $this->newPrice,
            'active_bidders_count' => $this->activeBiddersCount,
            'countdown_seconds' => $this->countdownSeconds,
            'auto_left_user_ids' => $this->autoLeftUserIds,
        ];
    }
}
