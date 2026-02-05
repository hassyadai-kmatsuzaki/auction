<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BidderUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $auctionId;
    public int $laneId;
    public int $itemId;
    public int $activeBiddersCount;
    public string $eventType; // 'joined' or 'left'

    /**
     * Create a new event instance.
     */
    public function __construct(
        int $auctionId,
        int $laneId,
        int $itemId,
        int $activeBiddersCount,
        string $eventType
    ) {
        $this->auctionId = $auctionId;
        $this->laneId = $laneId;
        $this->itemId = $itemId;
        $this->activeBiddersCount = $activeBiddersCount;
        $this->eventType = $eventType;
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
        return 'bidder.updated';
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
            'active_bidders_count' => $this->activeBiddersCount,
            'event_type' => $this->eventType,
        ];
    }
}
