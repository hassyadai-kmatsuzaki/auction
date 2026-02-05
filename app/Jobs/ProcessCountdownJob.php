<?php

namespace App\Jobs;

use App\Services\CountdownService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessCountdownJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $laneId;
    public int $maxIterations;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 1;

    /**
     * Create a new job instance.
     */
    public function __construct(int $laneId, int $maxIterations = 300)
    {
        $this->laneId = $laneId;
        $this->maxIterations = $maxIterations; // 最大5分（300秒）
        $this->onQueue('countdown'); // 専用キュー
    }

    /**
     * Execute the job.
     */
    public function handle(CountdownService $countdownService): void
    {
        $iterations = 0;

        while ($iterations < $this->maxIterations) {
            $state = $countdownService->getCountdownState($this->laneId);
            
            // カウントダウンが停止されたら終了
            if (!$state || !$state['is_running']) {
                Log::info("Countdown job stopped for lane {$this->laneId}");
                break;
            }

            // 1秒待機
            sleep(1);

            // カウントダウンをティック
            $result = $countdownService->tick($this->laneId);

            if (!$result) {
                Log::info("Countdown job ended for lane {$this->laneId} (no result)");
                break;
            }

            // カウントダウン終了した場合
            if ($result['action'] === 'countdown_end') {
                // 次の商品があれば、新しいカウントダウンが自動開始される
                // ジョブは継続
                if (!$result['next_item']) {
                    Log::info("Countdown job ended for lane {$this->laneId} (no next item)");
                    break;
                }
            }

            $iterations++;
        }

        Log::info("Countdown job completed for lane {$this->laneId}, iterations: {$iterations}");
    }
}
