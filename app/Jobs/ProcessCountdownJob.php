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
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 600;

    /**
     * Tick interval in milliseconds (500ms = 0.5 seconds)
     */
    public const TICK_INTERVAL_MS = 500;

    /**
     * Create a new job instance.
     */
    public function __construct(int $laneId, int $maxIterations = 600)
    {
        $this->laneId = $laneId;
        $this->maxIterations = $maxIterations; // 最大5分（600回 × 0.5秒）
        $this->onQueue('countdown'); // 専用キュー
    }

    /**
     * Execute the job.
     */
    public function handle(CountdownService $countdownService): void
    {
        Log::info("Countdown job STARTED for lane {$this->laneId} (interval: " . self::TICK_INTERVAL_MS . "ms)");
        
        $iterations = 0;

        while ($iterations < $this->maxIterations) {
            $state = $countdownService->getCountdownState($this->laneId);
            
            // カウントダウンが停止されたら終了
            if (!$state || !$state['is_running']) {
                break;
            }

            // 0.5秒（500ms）待機
            usleep(self::TICK_INTERVAL_MS * 1000);

            // カウントダウンをティック
            try {
                $result = $countdownService->tick($this->laneId);
            } catch (\Exception $e) {
                Log::error("Countdown tick error for lane {$this->laneId}: " . $e->getMessage());
                break;
            }

            if (!$result) {
                break;
            }

            // カウントダウン終了した場合
            if ($result['action'] === 'countdown_end') {
                // 次の商品があれば、新しいカウントダウンが自動開始される
                // ジョブは継続
                if (!$result['next_item']) {
                    break;
                }
            }

            $iterations++;
        }

        Log::info("Countdown job COMPLETED for lane {$this->laneId}, iterations: {$iterations}");
    }
}
