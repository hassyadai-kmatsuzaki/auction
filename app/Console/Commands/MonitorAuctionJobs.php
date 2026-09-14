<?php

namespace App\Console\Commands;

use App\Jobs\ProcessAuctionCountdownJob;
use App\Models\Auction;
use App\Services\CountdownService;
use App\Services\Monitoring\MetricRecorder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * ライブオークションのカウントダウンジョブを監視し、
 * 死んでいるジョブを自動で再ディスパッチする。
 *
 * スケジューラーから1分ごとに実行される想定。
 *
 * R3 (2026-09-14):
 *   - 開始直後の猶予: 自動開始と同じ秒に走ると心拍がまだ無く二重ディスパッチになる（9/11 に発生、無害だが不要）
 *   - 確定済みの商品を指したまま止まったレーン（経路 B）を見つけて次の商品へ進める（ジョブ側の 3 秒復旧の二重防御）
 *   - 毎分 LiveAuctions / StalledLanes を CloudWatch へ出す（ライブが無い時間帯の欠測と区別するため）
 */
class MonitorAuctionJobs extends Command
{
    protected $signature = 'auctions:monitor-jobs';

    protected $description = 'ライブオークションのカウントダウンジョブを監視し、停止していれば自動復旧する';

    private const HEARTBEAT_STALE_SECONDS = 30;

    /** 開始（status が live になった時刻）からこの秒数は再ディスパッチしない */
    private const START_GRACE_SECONDS = 60;

    /** レーンが確定済みの商品を指したままこの秒数を超えたら停止とみなす（切替中の一瞬は除く） */
    private const LANE_STALL_SECONDS = 15;

    public function handle(): int
    {
        $liveAuctions = Auction::where('status', 'live')->get();
        $stalled = 0;

        foreach ($liveAuctions as $auction) {
            $this->checkAndRecover($auction);
            $stalled += $this->recoverStalledLanes($auction);
        }

        try {
            app(MetricRecorder::class)->monitorRun($liveAuctions->count(), $stalled);
        } catch (\Throwable $e) {
            Log::warning('MetricRecorder failed for monitor run: ' . $e->getMessage());
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

        // 開始直後は猶予（live になった更新から 60 秒。ジョブは開始 1〜2 秒後に心拍を書く）
        if ($auction->updated_at && $auction->updated_at->gt(now()->subSeconds(self::START_GRACE_SECONDS))) {
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

        // 全ロックをクリア（先にクリアして新ジョブがロック取得できるようにする）
        Cache::forget($jobKey);
        Cache::forget($heartbeatKey);
        Cache::forget($lockKey);

        // 世代番号をインクリメント → 古いジョブは次のループで自発的に終了する
        $genKey = ProcessAuctionCountdownJob::generationKey($auction->id);
        $newGen = ((int) Cache::get($genKey, 0)) + 1;
        Cache::put($genKey, $newGen, ProcessAuctionCountdownJob::HEARTBEAT_TTL);

        ProcessAuctionCountdownJob::dispatch($auction->id);

        $staleSec = $heartbeat ? (now()->timestamp - $heartbeat) : null;
        Log::warning('countdown.job.re_dispatched', [
            'auction_id' => $auction->id,
            'heartbeat_age_seconds' => $staleSec,
            'new_generation' => $newGen,
        ]);
        $this->warn(
            "Auction {$auction->id}: ジョブを再ディスパッチしました (heartbeat: "
            . ($staleSec === null ? 'なし' : "{$staleSec}秒前") . ')'
        );
    }

    /**
     * 確定済み（sold / unsold / cancelled）の商品を指したまま止まっているレーンを次の商品へ進める。
     * 戻り値は見つけた停止レーンの数（復旧の成否は問わない）。
     */
    private function recoverStalledLanes(Auction $auction): int
    {
        $lanes = $auction->lanes()
            ->where('status', 'active')
            ->where('updated_at', '<', now()->subSeconds(self::LANE_STALL_SECONDS))
            ->with('currentItem')
            ->get();

        $found = 0;
        foreach ($lanes as $lane) {
            $item = $lane->currentItem;
            $stalled = !$lane->current_item_id || !$item || in_array($item->status, ['sold', 'unsold', 'cancelled'], true);
            if (!$stalled) {
                continue;
            }
            $found++;

            Log::warning('lane.stall.detected', [
                'auction_id'   => $auction->id,
                'lane_id'      => $lane->id,
                'item_id'      => $lane->current_item_id,
                'item_status'  => $item?->status,
                'lane_updated' => $lane->updated_at?->toIso8601String(),
            ]);

            $result = app(CountdownService::class)->recoverStalledLane($lane);
            if ($result['recovered']) {
                $this->warn("Lane {$lane->id}: 確定済みの商品 {$lane->current_item_id} を指したまま止まっていたので次の商品へ進めました (next=" . ($result['next_item_id'] ?? 'なし') . ')');
            } else {
                $this->error("Lane {$lane->id}: 停止していますが復旧できませんでした ({$result['reason']})。管理画面の「次の商品へ」で復旧してください");
            }
        }

        return $found;
    }
}
