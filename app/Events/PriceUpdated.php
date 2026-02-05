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
    public int $countdownSeconds;

    /**
     * Create a new event instance.
     */
    public function __construct(
        int $auctionId,
        int $laneId,
        int $itemId,
        float $newPrice,
        int $activeBiddersCount,
        int $countdownSeconds
    ) {
        $this->auctionId = $auctionId;
        $this->laneId = $laneId;
        $this->itemId = $itemId;
        $this->newPrice = $newPrice;
        $this->activeBiddersCount = $activeBiddersCount;
        $this->countdownSeconds = $countdownSeconds;
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
        ];
    }
}
