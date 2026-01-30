<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class LaneItemChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $auctionId;
    public int $laneId;
    public int $laneNumber;
    public ?int $previousItemId;
    public ?array $currentItem;

    /**
     * Create a new event instance.
     */
    public function __construct(
        int $auctionId,
        int $laneId,
        int $laneNumber,
        ?int $previousItemId,
        ?array $currentItem
    ) {
        $this->auctionId = $auctionId;
        $this->laneId = $laneId;
        $this->laneNumber = $laneNumber;
        $this->previousItemId = $previousItemId;
        $this->currentItem = $currentItem;
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
        return 'lane.changed';
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
            'lane_number' => $this->laneNumber,
            'previous_item_id' => $this->previousItemId,
            'current_item' => $this->currentItem,
        ];
    }
}
