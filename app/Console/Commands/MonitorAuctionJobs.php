<?php

namespace App\Console\Commands;

use App\Jobs\ProcessAuctionCountdownJob;
use App\Models\Auction;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * ライブオークションのカウントダウンジョブを監視し、
 * 死んでいるジョブを自動で再ディスパッチする。
 *
 * スケジューラーから1分ごとに実行される想定。
 */
class MonitorAuctionJobs extends Command
{
    protected $signature = 'auctions:monitor-jobs';

    protected $description = 'ライブオークションのカウントダウンジョブを監視し、停止していれば自動復旧する';

    private const HEARTBEAT_STALE_SECONDS = 30;

    public function handle(): int
    {
        $liveAuctions = Auction::where('status', 'live')->get();

        if ($liveAuctions->isEmpty()) {
            return 0;
        }

        foreach ($liveAuctions as $auction) {
            $this->checkAndRecover($auction);
        }

        return 0;
    }

    private function checkAndRecover(Auction $auction): void
    {
        $heartbeatKey  = "countdown_job_heartbeat:auction:{$auction->id}";
        $jobKey        = "countdown_job_running:auction:{$auction->id}";
        $lockKey       = "countdown_job_lock:auction:{$auction->id}";
        $finishedKey   = "countdown_job_finished:auction:{$auction->id}";

        // ジョブが正常終了した直後なら再ディスパッチ不要
        if (Cache::get($finishedKey)) {
            return;
        }

        $heartbeat = Cache::get($heartbeatKey);

        // ハートビートが存在し、かつ新鮮ならジョブは生きている
        if ($heartbeat && (now()->timestamp - $heartbeat) < self::HEARTBEAT_STALE_SECONDS) {
            return;
        }

        // アクティブまたは一時停止中のレーンが存在するか確認
        $hasWorkableLanes = $auction->lanes()
            ->whereIn('status', ['active', 'paused'])
            ->exists();

        if (!$hasWorkableLanes) {
            return;
        }

        // ジョブが死んでいると判断 → ロックをクリアして再ディスパッチ
        Cache::forget($jobKey);
        Cache::forget($heartbeatKey);
        Cache::forget($lockKey);

        ProcessAuctionCountdownJob::dispatch($auction->id);

        $staleSec = $heartbeat ? (now()->timestamp - $heartbeat) . '秒前' : 'なし';
        Log::warning("MonitorAuctionJobs: Re-dispatched countdown job for auction {$auction->id} (heartbeat: {$staleSec})");
        $this->warn("Auction {$auction->id}: ジョブを再ディスパッチしました (heartbeat: {$staleSec})");
    }
}
