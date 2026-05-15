<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * オークション開始前の 10 秒プレスタートカウントダウンの毎秒tick。
 *
 * AuctionStatusChanged(status='starting') と payload・チャネル・broadcastAs を
 * 完全に揃えてあるため、フロント側のリスナーは既存のまま受信できる。
 *
 * このイベントだけ ShouldBroadcastNow にしている理由:
 *   ShouldBroadcast(キュー経由) だと broadcasts キューの worker 経由になり、
 *   120 名規模では順序逆転・遅延が発生して「10→0」が綺麗に推移しなくなる。
 *   pre-start tick は countdown 専属 worker 内のループから直接呼ばれるため、
 *   同期送信(Now)のほうが順序・タイミングともに安定する。
 */
class AuctionStartCountdownTick implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $auctionId;
    public string $status;
    public string $message;
    public ?int $countdownSeconds;

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

    public function broadcastOn(): array
    {
        return [
            new Channel('auction.' . $this->auctionId . '.live'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'auction.status';
    }

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
