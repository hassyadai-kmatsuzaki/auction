<?php

namespace App\Jobs;

use App\Models\Auction;
use App\Models\Lane;
use App\Services\CountdownService;
use App\Services\NotificationService;
use App\Events\AuctionStatusChanged;
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
    public int $timeout = 14400; // 4時間

    /**
     * Tick interval in seconds (shared with CountdownService)
     */
    public const TICK_INTERVAL = 0.5;

    /**
     * Create a new job instance.
     *
     * maxIterations: 4時間分 = 4 * 60 * 60 / 0.5 = 28800
     */
    public function __construct(int $auctionId, int $maxIterations = 28800)
    {
        $this->auctionId = $auctionId;
        $this->maxIterations = $maxIterations;
        $this->onQueue('countdown'); // 専用キュー
    }

    /**
     * Execute the job.
     */
    public function handle(CountdownService $countdownService): void
    {
        Log::info("Auction countdown job STARTED for auction {$this->auctionId}");
        
        // ジョブ実行中フラグをセット（フェイルセーフ用・TTLはジョブtimeout+余裕）
        $jobKey = "countdown_job_running:auction:{$this->auctionId}";
        Cache::put($jobKey, true, $this->timeout + 600);
        Cache::put("countdown_job_heartbeat:auction:{$this->auctionId}", now()->timestamp, 300);

        // === 10秒プレスタートカウントダウン ===
        $startAtKey = "auction:{$this->auctionId}:start_at";
        $lanesToStartKey = "auction:{$this->auctionId}:lanes_to_start";
        $startAt = Cache::get($startAtKey);

        if ($startAt) {
            Log::info("Pre-start countdown for auction {$this->auctionId}");
            while (true) {
                $remaining = max(0, $startAt - now()->timestamp);
                if ($remaining <= 0) break;

                broadcast(new AuctionStatusChanged(
                    $this->auctionId,
                    'starting',
                    "開始まで {$remaining}秒",
                    $remaining
                ));
                sleep(1);
            }

            Cache::forget($startAtKey);

            // カウントダウン終了 → レーンのカウントダウンを実際に開始
            $lanesToStart = Cache::get($lanesToStartKey, []);
            Cache::forget($lanesToStartKey);

            foreach ($lanesToStart as $laneId) {
                $lane = Lane::with(['auction', 'currentItem'])->find($laneId);
                if ($lane && $lane->currentItem) {
                    $countdownService->startCountdown($lane);

                    // ★ 最初の商品にも事前指値の自動入札を適用
                    try {
                        $setBidLimitAction = app(\App\Actions\Bid\SetBidLimitAction::class);
                        $activated = $setBidLimitAction->activatePendingBidLimits($lane->currentItem);
                        if ($activated > 0) {
                            Log::info("Initial auto-bid: lane {$laneId}, activated {$activated} users");
                        }

                        // 指値2名以上 → 価格を自動調整（startFreeze=false: 最初のカウントダウンを維持）
                        if ($activated >= 2) {
                            $freshItem = $lane->currentItem->fresh();
                            $countdownService->adjustPriceByBidLimits($freshItem, $lane->auction, $lane, false);
                        }
                    } catch (\Exception $e) {
                        Log::warning("Initial auto-bid error lane {$laneId}: " . $e->getMessage());
                    }
                }
            }

            // ライブ開始イベントをブロードキャスト
            broadcast(new AuctionStatusChanged(
                $this->auctionId,
                'live',
                'オークションが開始されました'
            ));

            // オークション開始通知を送信（参加者 + 出品者）
            try {
                $auctionForNotification = Auction::find($this->auctionId);
                if ($auctionForNotification) {
                    $notificationService = app(\App\Services\NotificationService::class);
                    $sentCount = $notificationService->sendAuctionStartNotification($auctionForNotification);
                    $notificationService->sendSellerAuctionStartNotification($auctionForNotification);
                    Log::info("オークション開始通知送信: {$sentCount}件", ['auction_id' => $this->auctionId]);
                }
            } catch (\Exception $e) {
                Log::warning('オークション開始通知でエラー', ['error' => $e->getMessage()]);
            }

            Log::info("Pre-start countdown completed for auction {$this->auctionId}, lanes started");
        }
        
        $iterations = 0;
        $idleIterations = 0;
        $consecutiveErrors = 0;
        $heartbeatKey = "countdown_job_heartbeat:auction:{$this->auctionId}";

        while ($iterations < $this->maxIterations) {
            try {
            // オークション状態を確認
            $auction = Auction::with('lanes')->find($this->auctionId);
            
            if (!$auction || !in_array($auction->status, ['live', 'finished'])) {
                Log::info("Auction {$this->auctionId} is not live, stopping countdown job");
                break;
            }

            // 既に finished の場合も終了
            if ($auction->status === 'finished') {
                Log::info("Auction {$this->auctionId} has been finished, stopping countdown job");
                break;
            }

            $activeCount = 0;
            $pausedCount = 0;

            // 全レーンのカウントダウンを処理
            foreach ($auction->lanes as $lane) {
                if ($lane->status === 'paused') {
                    $pausedCount++;
                    continue;
                }

                if ($lane->status === 'active' && $lane->current_item_id) {
                    $state = $countdownService->getCountdownState($lane->id);

                    // ★ 復旧ロジック: active レーンにカウントダウンキャッシュがない場合は再作成
                    // 一時停止→再開後やキャッシュ消滅時に発生する
                    if (!$state) {
                        Log::warning("Lane {$lane->id} is active but has no countdown state - recovering");
                        try {
                            $lane->load(['auction', 'currentItem']);
                            if ($lane->currentItem && $lane->currentItem->status === 'live') {
                                $countdownService->startCountdown($lane);
                                $activeCount++;
                            }
                        } catch (\Exception $e) {
                            Log::error("Lane {$lane->id} recovery failed: " . $e->getMessage());
                        }
                        continue;
                    }

                    // is_running が false の場合はスキップ（一時停止→active に戻ったがresumeされてない）
                    if (!$state['is_running']) {
                        continue;
                    }

                    try {
                        $result = $countdownService->tick($lane->id);
                        if ($result) {
                            $activeCount++;
                        }
                    } catch (\Exception $e) {
                        Log::error("Countdown tick error for lane {$lane->id}: " . $e->getMessage());
                        // ★ 例外が発生してもレーンをアクティブとしてカウントする
                        // （次のティックで復旧する可能性があるため）
                        $activeCount++;
                    }
                }
            }

            // 一時停止中のレーンがある場合はループを継続（ジョブを終了しない）
            if ($pausedCount > 0 && $activeCount === 0) {
                $idleIterations++;
                usleep((int)(self::TICK_INTERVAL * 1_000_000));
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

            $consecutiveErrors = 0; // 正常完了したらリセット

            } catch (\Exception $e) {
                $consecutiveErrors++;
                Log::error("Auction countdown loop error #{$consecutiveErrors}: " . $e->getMessage());

                // 連続100回エラーが続いたら異常と判断してジョブ終了
                if ($consecutiveErrors >= 100) {
                    Log::critical("Auction {$this->auctionId}: Too many consecutive errors ({$consecutiveErrors}), stopping job");
                    break;
                }
            }

            // ハートビート更新（5秒ごと）
            if ($iterations % 10 === 0) {
                Cache::put($heartbeatKey, now()->timestamp, 300);
            }

            usleep((int)(self::TICK_INTERVAL * 1_000_000));
            $iterations++;
        }

        // ジョブ実行中フラグ・ハートビートをクリア
        Cache::forget($jobKey);
        Cache::forget($heartbeatKey);
        
        Log::info("Auction countdown job COMPLETED for auction {$this->auctionId}, iterations: {$iterations}, idle: {$idleIterations}");
    }
}
