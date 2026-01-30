<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ItemSold implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $auctionId;
    public int $laneId;
    public int $itemId;
    public int $winnerId;
    public float $winningPrice;

    /**
     * Create a new event instance.
     */
    public function __construct(
        int $auctionId,
        int $laneId,
        int $itemId,
        int $winnerId,
        float $winningPrice
    ) {
        $this->auctionId = $auctionId;
        $this->laneId = $laneId;
        $this->itemId = $itemId;
        $this->winnerId = $winnerId;
        $this->winningPrice = $winningPrice;
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
        return 'item.sold';
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
            'winner_id' => $this->winnerId,
            'winning_price' => $this->winningPrice,
        ];
    }
}
