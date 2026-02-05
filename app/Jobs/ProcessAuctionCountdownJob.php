<?php

namespace App\Jobs;

use App\Models\Auction;
use App\Services\CountdownService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
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
        
        $iterations = 0;

        while ($iterations < $this->maxIterations) {
            // オークション状態を確認
            $auction = Auction::with('lanes')->find($this->auctionId);
            
            if (!$auction || $auction->status !== 'live') {
                Log::info("Auction {$this->auctionId} is not live, stopping countdown job");
                break;
            }

            $activeCount = 0;

            // 全レーンのカウントダウンを処理
            foreach ($auction->lanes as $lane) {
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

            // アクティブなレーンがなければ終了
            if ($activeCount === 0) {
                // まだライブ状態なら、アクティブなレーンがあるか再確認
                $auction->refresh();
                $hasActiveLanes = $auction->lanes()
                    ->where('status', 'active')
                    ->whereNotNull('current_item_id')
                    ->exists();
                
                if (!$hasActiveLanes) {
                    Log::info("No active lanes in auction {$this->auctionId}, stopping countdown job");
                    break;
                }
            }

            // 1秒待機
            sleep(1);
            $iterations++;
        }

        Log::info("Auction countdown job COMPLETED for auction {$this->auctionId}, iterations: {$iterations}");
    }
}
