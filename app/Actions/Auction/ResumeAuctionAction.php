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

        $jobKey = "countdown_job_running:auction:{$auction->id}";
        $heartbeatKey = "countdown_job_heartbeat:auction:{$auction->id}";
        $lockKey = "countdown_job_lock:auction:{$auction->id}";
        $heartbeat = Cache::get($heartbeatKey);
        $staleSec = $heartbeat ? now()->timestamp - $heartbeat : null;
        $jobAlive = $heartbeat && $staleSec < 30;

        if (!$jobAlive) {
            // 全ロックをクリア（先にクリアして新ジョブがロック取得できるようにする）
            Cache::forget($jobKey);
            Cache::forget($heartbeatKey);
            Cache::forget($lockKey);
            Cache::forget("countdown_job_finished:auction:{$auction->id}");

            // 世代番号をアトミックにインクリメント → 古いジョブは次のループで自発的に終了する
            $genKey = ProcessAuctionCountdownJob::generationKey($auction->id);
            // Cache::increment はアトミック操作。複数管理者が同時にresumeしても重複しない
            if (!Cache::has($genKey)) {
                Cache::put($genKey, 0, 14400); // 世代番号はジョブtimeout(4時間)分保持
            }
            $newGen = Cache::increment($genKey);

            $reason = $heartbeat ? "heartbeat {$staleSec}s stale" : 'heartbeat missing';
            Log::info("Resume: Re-dispatching countdown job for auction {$auction->id} ({$reason}, generation={$newGen})");
            ProcessAuctionCountdownJob::dispatch($auction->id);
        } else {
            Log::info("Resume: Countdown job alive for auction {$auction->id} (heartbeat {$staleSec}s ago)");
        }

        broadcast(new AuctionStatusChanged($auction->id, 'resumed', 'オークションが再開されました'));

        return AuctionResultDto::success('全レーンを再開しました。');
    }
}
