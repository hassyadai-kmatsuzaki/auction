<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AuctionStatusChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $auctionId;
    public string $status;
    public string $message;
    public ?int $countdownSeconds;

    /**
     * Create a new event instance.
     */
    public function __construct(
        int $auctionId,
        string $status,
        string $message = '',
        ?int $countdownSeconds = null
    ) {
        $this->auctionId = $auctionId;
        $this->status = $status;
        $this->message = $message;
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
        return 'auction.status';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'auction_id' => $this->auctionId,
            'status' => $this->status,
            'message' => $this->message,
            'countdown_seconds' => $this->countdownSeconds,
        ];
    }
}
