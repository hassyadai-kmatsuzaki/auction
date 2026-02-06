<?php

namespace App\Jobs;

use App\Models\Auction;
use App\Services\CountdownService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * オークション全体のカウントダウンを処理するジョブ
 * 全レーンを1つのジョブで並行処理
 */
class ProcessAuctionCountdownJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $auctionId;
    public int $maxIterations;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 1;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 3600; // 1時間

    /**
     * Create a new job instance.
     */
    public function __construct(int $auctionId, int $maxIterations = 3600)
    {
        $this->auctionId = $auctionId;
        $this->maxIterations = $maxIterations; // 最大1時間
        $this->onQueue('countdown'); // 専用キュー
    }

    /**
     * Execute the job.
     */
    public function handle(CountdownService $countdownService): void
    {
        Log::info("Auction countdown job STARTED for auction {$this->auctionId}");
        
        // ジョブ実行中フラグをセット（フェイルセーフ用）
        $jobKey = "countdown_job_running:auction:{$this->auctionId}";
        Cache::put($jobKey, true, 3600);
        
        $iterations = 0;
        $idleIterations = 0; // 一時停止中の待機カウント

        while ($iterations < $this->maxIterations) {
            // オークション状態を確認
            $auction = Auction::with('lanes')->find($this->auctionId);
            
            if (!$auction || $auction->status !== 'live') {
                Log::info("Auction {$this->auctionId} is not live, stopping countdown job");
                break;
            }

            $activeCount = 0;
            $pausedCount = 0;

            // 全レーンのカウントダウンを処理
            foreach ($auction->lanes as $lane) {
                if ($lane->status === 'paused') {
                    // 一時停止中のレーンはカウントせず待機
                    $pausedCount++;
                    continue;
                }

                if ($lane->status === 'active' && $lane->current_item_id) {
                    $state = $countdownService->getCountdownState($lane->id);
                    
                    if ($state && $state['is_running']) {
                        try {
                            $result = $countdownService->tick($lane->id);
                            if ($result) {
                                $activeCount++;
                            }
                        } catch (\Exception $e) {
                            Log::error("Countdown tick error for lane {$lane->id}: " . $e->getMessage());
                        }
                    }
                }
            }

            // 一時停止中のレーンがある場合はループを継続（ジョブを終了しない）
            if ($pausedCount > 0 && $activeCount === 0) {
                $idleIterations++;
                sleep(1);
                $iterations++;
                continue;
            }

            // アクティブなレーンがなければ終了判定
            if ($activeCount === 0) {
                $auction->refresh();
                $hasActiveLanes = $auction->lanes()
                    ->where('status', 'active')
                    ->whereNotNull('current_item_id')
                    ->exists();
                
                // 一時停止中のレーンも存在しないことを確認してから終了
                $hasPausedLanes = $auction->lanes()
                    ->where('status', 'paused')
                    ->exists();
                
                if (!$hasActiveLanes && !$hasPausedLanes) {
                    Log::info("No active or paused lanes in auction {$this->auctionId}, stopping countdown job");
                    break;
                }
            }

            // 1秒待機
            sleep(1);
            $iterations++;
        }

        // ジョブ実行中フラグをクリア
        Cache::forget($jobKey);
        
        Log::info("Auction countdown job COMPLETED for auction {$this->auctionId}, iterations: {$iterations}, idle: {$idleIterations}");
    }
}
