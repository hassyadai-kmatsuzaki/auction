<?php

namespace App\Actions\Auction;

use App\DTOs\AuctionResultDto;
use App\Events\AuctionStatusChanged;
use App\Jobs\ProcessAuctionCountdownJob;
use App\Models\Auction;
use App\Repositories\Contracts\LaneRepositoryInterface;
use App\Services\CountdownService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class ResumeAuctionAction
{
    public function __construct(
        private readonly CountdownService        $countdown,
        private readonly LaneRepositoryInterface $laneRepo,
    ) {}

    public function execute(Auction $auction): AuctionResultDto
    {
        if ($auction->status !== 'live') {
            return AuctionResultDto::failure('開催中のオークションのみ再開できます。');
        }

        $this->laneRepo->updateStatusByAuction($auction->id, 'paused', 'active');

        foreach ($this->laneRepo->getActiveByAuction($auction->id) as $lane) {
            $this->countdown->resumeCountdown($lane->id);
        }

        // フェイルセーフ: ジョブが死んでいたら再ディスパッチ
        $jobKey = "countdown_job_running:auction:{$auction->id}";
        if (!Cache::get($jobKey, false)) {
            Log::info("Resume: Re-dispatching countdown job for auction {$auction->id}");
            ProcessAuctionCountdownJob::dispatch($auction->id);
        }

        broadcast(new AuctionStatusChanged($auction->id, 'resumed', 'オークションが再開されました'));

        return AuctionResultDto::success('全レーンを再開しました。');
    }
}
