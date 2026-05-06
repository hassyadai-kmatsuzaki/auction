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
    public int $generation;

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
     * Heartbeat TTL in seconds.
     * Must be longer than any expected pause duration.
     */
    public const HEARTBEAT_TTL = 14400; // 4時間（ジョブtimeoutと同じ）

    /**
     * Create a new job instance.
     *
     * maxIterations: 4時間分 = 4 * 60 * 60 / 0.5 = 28800
     */
    public function __construct(int $auctionId, int $maxIterations = 28800)
    {
        $this->auctionId = $auctionId;
        $this->maxIterations = $maxIterations;
        $this->generation = (int) Cache::get("countdown_job_generation:auction:{$auctionId}", 0);
        $this->onQueue('countdown'); // 専用キュー
    }

    /**
     * 世代番号のキャッシュキーを取得
     */
    public static function generationKey(int $auctionId): string
    {
        return "countdown_job_generation:auction:{$auctionId}";
    }

    /**
     * 現在の世代番号が有効かチェック（古い世代のジョブは自発的に終了すべき）
     */
    private function isCurrentGeneration(): bool
    {
        $current = (int) Cache::get(self::generationKey($this->auctionId), 0);
        return $this->generation === $current;
    }

    /**
     * Execute the job.
     */
    public function handle(CountdownService $countdownService): void
    {
        // 世代チェック: ディスパッチ後に世代が進んでいたら即終了
        if (!$this->isCurrentGeneration()) {
            Log::info('countdown.job.skipped_outdated_generation', [
                'auction_id' => $this->auctionId,
                'job_generation' => $this->generation,
                'current_generation' => (int) Cache::get(self::generationKey($this->auctionId), 0),
            ]);
            return;
        }

        // 排他制御: 同一オークションで複数ジョブが同時実行されるのを防ぐ
        $lockKey = "countdown_job_lock:auction:{$this->auctionId}";
        $lockAcquired = Cache::add($lockKey, getmypid(), $this->timeout + 60);

        if (!$lockAcquired) {
            $existingPid = Cache::get($lockKey);
            Log::warning('countdown.job.skipped_lock_held', [
                'auction_id' => $this->auctionId,
                'existing_pid' => $existingPid,
            ]);
            return;
        }

        Log::info('countdown.job.started', [
            'auction_id' => $this->auctionId,
            'pid' => getmypid(),
            'generation' => $this->generation,
        ]);
        
        // ジョブ実行中フラグをセット（フェイルセーフ用・TTLはジョブtimeout+余裕）
        $jobKey = "countdown_job_running:auction:{$this->auctionId}";
        Cache::put($jobKey, true, $this->timeout + 600);
        Cache::put("countdown_job_heartbeat:auction:{$this->auctionId}", now()->timestamp, self::HEARTBEAT_TTL);

        // === 10秒プレスタートカウントダウン ===
        $startAtKey = "auction:{$this->auctionId}:start_at";
        $lanesToStartKey = "auction:{$this->auctionId}:lanes_to_start";
        $startAt = Cache::get($startAtKey);

        if ($startAt) {
            Log::info("Pre-start countdown for auction {$this->auctionId}");
            while (true) {
                if (!$this->isCurrentGeneration()) {
                    Log::info("Auction {$this->auctionId}: generation superseded during pre-start (job={$this->generation}), stopping");
                    Cache::forget($jobKey);
                    Cache::forget("countdown_job_heartbeat:auction:{$this->auctionId}");
                    Cache::forget($lockKey);
                    return;
                }
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

            // カウントダウン完了: キャッシュを即座にクリアして
            // APIポーリングが 'starting' を返さないようにする
            Cache::forget($startAtKey);

            // カウントダウン終了 → レーンのカウントダウンを実際に開始
            $lanesToStart = Cache::get($lanesToStartKey, []);
            Cache::forget($lanesToStartKey);

            foreach ($lanesToStart as $laneId) {
                $lane = Lane::with(['auction', 'currentItem'])->find($laneId);
                if ($lane && $lane->currentItem) {
                    // 実装書 B4: countdown cache 事前 warmup（cache miss recovered の防止）
                    //   修正前: 起動瞬間に getLiveState 並行呼び出しで cache 未生成 → 8件の miss/recovery
                    //   修正後: startCountdown 前に cache 既存チェック→idempotent で warmup
                    $existingState = Cache::get("countdown:lane:{$laneId}");
                    if (!$existingState) {
                        Log::info("countdown cache warmup: lane {$laneId}");
                    }
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
            // 失敗してもライブ進行は止めないが、全員に通知が届かない事象は重大なので
            // CloudWatch メトリクスに失敗を記録し、運用側で検知できるようにする。
            try {
                $auctionForNotification = Auction::find($this->auctionId);
                if ($auctionForNotification) {
                    $notificationService = app(\App\Services\NotificationService::class);
                    $sentCount = $notificationService->sendAuctionStartNotification($auctionForNotification);
                    $notificationService->sendSellerAuctionStartNotification($auctionForNotification);
                    Log::info('auction.start_notification.sent', [
                        'auction_id' => $this->auctionId,
                        'sent_count' => $sentCount,
                    ]);
                }
            } catch (\Exception $e) {
                Log::warning('auction.start_notification.failed', [
                    'auction_id' => $this->auctionId,
                    'error' => $e->getMessage(),
                ]);
                try {
                    app(\App\Services\Monitoring\MetricRecorder::class)->jobFailure(
                        'AuctionStartNotification',
                        $e->getMessage(),
                        ['auction_id' => (string) $this->auctionId]
                    );
                } catch (\Throwable $metricErr) {
                    Log::warning('MetricRecorder failed for start notification: ' . $metricErr->getMessage());
                }
            }

            Log::info("Pre-start countdown completed for auction {$this->auctionId}, lanes started");
        }
        
        $iterations = 0;
        $idleIterations = 0;
        $consecutiveErrors = 0;
        $heartbeatKey = "countdown_job_heartbeat:auction:{$this->auctionId}";

        while ($iterations < $this->maxIterations) {
            // 世代チェック: 再開等で新しいジョブがディスパッチされたら自発的に終了
            if (!$this->isCurrentGeneration()) {
                Log::info("Auction {$this->auctionId}: generation superseded (job={$this->generation}), stopping gracefully");
                break;
            }

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
                        // 例外時は activeCount を増やさない（過去の "ghost lane" 事故対策）。
                        // 旧版は「次のティックで復旧する可能性」で ++ していたが、
                        // 静かに死んだレーンが永遠に active 扱いされてジョブが終了しない事故を招くため削除。
                        // 復旧は次イテレーションで「!$state → recovery startCountdown」経路に任せる。
                        // 一時的な異常で全 lane 死亡判定にならないよう、auction.lanes の DB 再確認は
                        // L307-318 の終了判定が担う（active_count==0 → DB に active レーンが残っていないか
                        // exists チェックで二重防御）。
                        Log::error("Countdown tick error for lane {$lane->id}: " . $e->getMessage());
                        app(\App\Services\Monitoring\MetricRecorder::class)->jobFailure('CountdownTick', "lane={$lane->id}: " . $e->getMessage());
                    }
                }
            }

            // 一時停止中のレーンがある場合はループを継続（ジョブを終了しない）
            if ($pausedCount > 0 && $activeCount === 0) {
                $idleIterations++;
                // 一時停止中もハートビートを更新（5秒ごと）
                if ($iterations % 10 === 0) {
                    Cache::put($heartbeatKey, now()->timestamp, self::HEARTBEAT_TTL);
                }
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

                // 連続1000回（約8分）エラーが続いたら異常と判断してジョブ終了
                if ($consecutiveErrors >= 1000) {
                    Log::critical("Auction {$this->auctionId}: Too many consecutive errors ({$consecutiveErrors}), stopping job");
                    break;
                }
            }

            // ハートビート更新（5秒ごと）
            if ($iterations % 10 === 0) {
                Cache::put($heartbeatKey, now()->timestamp, self::HEARTBEAT_TTL);
            }

            usleep((int)(self::TICK_INTERVAL * 1_000_000));
            $iterations++;
        }

        $superseded = !$this->isCurrentGeneration();

        if (!$superseded) {
            // 正常終了マーカーをセット（MonitorAuctionJobs が不要な再ディスパッチをしないように）
            Cache::put("countdown_job_finished:auction:{$this->auctionId}", true, 120);
        }

        // ジョブ実行中フラグ・ハートビート・ロックをクリア
        Cache::forget($jobKey);
        Cache::forget($heartbeatKey);
        Cache::forget($lockKey);

        Log::info('countdown.job.completed', [
            'auction_id' => $this->auctionId,
            'iterations' => $iterations,
            'idle_iterations' => $idleIterations,
            'superseded' => $superseded,
        ]);
    }

    /**
     * ジョブ失敗時のフック（tries を使い切った / 未捕捉例外）
     * CloudWatch メトリクスに失敗を記録する
     */
    public function failed(\Throwable $e): void
    {
        try {
            app(\App\Services\Monitoring\MetricRecorder::class)->jobFailure(
                'ProcessAuctionCountdownJob',
                $e->getMessage(),
                [
                    'auction_id' => (string) $this->auctionId,
                    'generation' => (string) $this->generation,
                ]
            );
        } catch (\Throwable $metricErr) {
            Log::warning('MetricRecorder failed in job failed(): ' . $metricErr->getMessage());
        }

        Log::critical("ProcessAuctionCountdownJob FAILED auction={$this->auctionId}: " . $e->getMessage());
    }
}
