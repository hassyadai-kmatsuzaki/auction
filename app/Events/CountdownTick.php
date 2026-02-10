<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CountdownTick implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $auctionId;
    public int $laneId;
    public int $itemId;
    public int $remainingSeconds;
    public int $activeBiddersCount;
    public int $currentPrice;
    public string $phase;

    /**
     * Create a new event instance.
     */
    public function __construct(
        int $auctionId,
        int $laneId,
        int $itemId,
        int $remainingSeconds,
        int $activeBiddersCount,
        int $currentPrice,
        string $phase = 'bidding'
    ) {
        $this->auctionId = $auctionId;
        $this->laneId = $laneId;
        $this->itemId = $itemId;
        $this->remainingSeconds = $remainingSeconds;
        $this->activeBiddersCount = $activeBiddersCount;
        $this->currentPrice = $currentPrice;
        $this->phase = $phase;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel("auction.{$this->auctionId}.live"),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'countdown.tick';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'lane_id' => $this->laneId,
            'item_id' => $this->itemId,
            'remaining_seconds' => $this->remainingSeconds,
            'active_bidders_count' => $this->activeBiddersCount,
            'current_price' => $this->currentPrice,
            'phase' => $this->phase,
        ];
    }
}
