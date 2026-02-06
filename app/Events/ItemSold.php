<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ItemSold implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $auctionId;
    public int $laneId;
    public int $itemId;
    public int $winnerId;
    public float $winningPrice;
    public string $speciesName;
    public int $itemNumber;
    public int $quantity;

    /**
     * Create a new event instance.
     */
    public function __construct(
        int $auctionId,
        int $laneId,
        int $itemId,
        int $winnerId,
        float $winningPrice,
        string $speciesName = '',
        int $itemNumber = 0,
        int $quantity = 1
    ) {
        $this->auctionId = $auctionId;
        $this->laneId = $laneId;
        $this->itemId = $itemId;
        $this->winnerId = $winnerId;
        $this->winningPrice = $winningPrice;
        $this->speciesName = $speciesName;
        $this->itemNumber = $itemNumber;
        $this->quantity = $quantity;
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
            'species_name' => $this->speciesName,
            'item_number' => $this->itemNumber,
            'quantity' => $this->quantity,
        ];
    }
}
