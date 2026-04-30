<?php

namespace App\Jobs;

use App\Services\CountdownService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * @deprecated レガシー（レーン単位カウントダウン）。
 * 本番ではオークション全体を1ジョブで処理する {@see ProcessAuctionCountdownJob} のみを使用する。
 * このクラスは残しているが handle() は何もしない。
 * もしこのジョブが dispatch されたら警告ログを残してテレメトリで検知できるようにしている。
 */
class ProcessCountdownJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $laneId;
    public int $maxIterations;

    public int $tries = 1;
    public int $timeout = 600;

    public const TICK_INTERVAL_MS = 500;

    public function __construct(int $laneId, int $maxIterations = 600)
    {
        $this->laneId = $laneId;
        $this->maxIterations = $maxIterations;
        $this->onQueue('countdown');
    }

    public function handle(CountdownService $countdownService): void
    {
        Log::warning('ProcessCountdownJob is deprecated and should not be dispatched.', [
            'lane_id' => $this->laneId,
            'replacement' => ProcessAuctionCountdownJob::class,
        ]);
    }
}
