<?php

namespace App\Actions\Auction;

use App\DTOs\AuctionResultDto;
use App\Events\AuctionStatusChanged;
use App\Models\Auction;
use App\Repositories\Contracts\LaneRepositoryInterface;
use App\Services\CountdownService;

class PauseAuctionAction
{
    public function __construct(
        private readonly CountdownService        $countdown,
        private readonly LaneRepositoryInterface $laneRepo,
    ) {}

    public function execute(Auction $auction): AuctionResultDto
    {
        if ($auction->status !== 'live') {
            return AuctionResultDto::failure('開催中のオークションのみ一時停止できます。');
        }

        foreach ($this->laneRepo->getActiveByAuction($auction->id) as $lane) {
            $this->countdown->pauseCountdown($lane->id);
        }

        $this->laneRepo->updateStatusByAuction($auction->id, 'active', 'paused');

        broadcast(new AuctionStatusChanged($auction->id, 'paused', 'オークションが一時停止されました'));

        return AuctionResultDto::success('全レーンを一時停止しました。');
    }
}
