<?php

namespace App\Actions\Auction;

use App\DTOs\AuctionResultDto;
use App\Events\AuctionStatusChanged;
use App\Jobs\ProcessAuctionCountdownJob;
use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * オークションステータス更新アクション（管理者UI用）
 */
class UpdateAuctionStatusAction
{
    private const LABELS = [
        'preparing' => '準備中',
        'scheduled' => '予定（出品受付中）',
        'live'      => '開催中',
        'finished'  => '終了',
        'cancelled' => 'キャンセル',
    ];

    public function __construct(
        private readonly NotificationService $notificationService,
    ) {}

    public function execute(Auction $auction, string $newStatus): AuctionResultDto
    {
        $oldStatus = $auction->status;

        if ($newStatus === $oldStatus) {
            return AuctionResultDto::success(
                'ステータスは既に「' . (self::LABELS[$newStatus] ?? $newStatus) . '」です。',
                ['auction' => $auction->load(['creator:id,name'])]
            );
        }

        $message = match ($newStatus) {
            'preparing' => $this->toPreparingState($auction),
            'scheduled' => $this->toScheduledState($auction, $oldStatus),
            'live'      => $this->toLiveState($auction),
            'finished'  => $this->toFinishedState($auction),
            'cancelled' => $this->toCancelledState($auction),
            default     => null,
        };

        if ($message === null) {
            return AuctionResultDto::failure('不正なステータスです。');
        }

        if (is_array($message)) {
            return AuctionResultDto::failure($message['error']);
        }

        $auction->load(['creator:id,name']);
        return AuctionResultDto::success($message, ['auction' => $auction]);
    }

    private function toPreparingState(Auction $auction): string
    {
        $auction->update(['status' => 'preparing']);
        return 'ステータスを「準備中」に変更しました。';
    }

    private function toScheduledState(Auction $auction, string $oldStatus): string
    {
        $auction->update(['status' => 'scheduled']);

        if ($oldStatus !== 'scheduled') {
            try {
                $sentCount = $this->notificationService->sendNewAuctionNotification($auction);
                Log::info("新規オークション通知送信: {$sentCount}件", ['auction_id' => $auction->id]);
            } catch (\Exception $e) {
                Log::warning('新規オークション通知でエラー', ['error' => $e->getMessage()]);
            }
        }

        return 'ステータスを「予定（出品受付中）」に変更しました。';
    }

    private function toLiveState(Auction $auction): string|array
    {
        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return ['error' => 'オークションを開始できません。現在のステータスでは開始できません。'];
        }

        if ($auction->items()->where('status', 'registered')->count() === 0) {
            return ['error' => 'オークションを開始できません。承認済みの生体を1件以上登録してください。'];
        }

        DB::beginTransaction();
        try {
            // レーンを作成（まだない場合）
            if ($auction->lanes()->count() === 0) {
                $laneCount = $auction->lane_count ?: 1;
                for ($i = 1; $i <= $laneCount; $i++) {
                    Lane::create([
                        'auction_id' => $auction->id,
                        'lane_number' => $i,
                        'status' => 'waiting',
                    ]);
                }
            }

            // 商品をレーンに割り当て
            $lanes = $auction->lanes()->orderBy('lane_number')->get();
            $laneCount = $lanes->count();

            if ($laneCount > 0) {
                $unassigned = $auction->items()
                    ->where('status', 'registered')
                    ->whereNotIn('id', function ($q) use ($auction) {
                        $q->select('item_id')->from('lane_items')
                          ->join('lanes', 'lane_items.lane_id', '=', 'lanes.id')
                          ->where('lanes.auction_id', $auction->id);
                    })
                    ->orderByDesc('is_premium')
                    ->orderBy('item_number')
                    ->get();

                foreach ($unassigned as $index => $item) {
                    $lane = $lanes[$index % $laneCount];
                    $maxOrder = DB::table('lane_items')->where('lane_id', $lane->id)->max('sequence_order') ?? 0;
                    DB::table('lane_items')->insert([
                        'lane_id'        => $lane->id,
                        'item_id'        => $item->id,
                        'sequence_order' => $maxOrder + 1,
                        'created_at'     => now(),
                        'updated_at'     => now(),
                    ]);
                }
            }

            // オークションを開始
            $auction->update(['status' => 'live']);

            // 各レーンの最初の商品をライブに
            $lanesToStart = [];
            foreach ($auction->lanes()->get() as $lane) {
                $nextItem = $lane->items()
                    ->where('status', 'registered')
                    ->orderBy('lane_items.sequence_order')
                    ->first();

                if ($nextItem) {
                    $nextItem->update([
                        'status' => 'live',
                        'current_price' => $nextItem->start_price,
                    ]);
                    $lane->update([
                        'current_item_id' => $nextItem->id,
                        'status' => 'active',
                    ]);
                    $lanesToStart[] = $lane->id;
                }
            }

            DB::commit();

            // 開始カウントダウン
            $countdownSeconds = $auction->getStartCountdownSeconds();

            // 古いロック・フラグが残っている場合はクリア（前回のオークションの残骸対策）
            // ※ StartAuctionAction と同等のクリーンアップ。start_at は Cache::add のガード対象なので forget しない
            Cache::forget("countdown_job_lock:auction:{$auction->id}");
            Cache::forget("countdown_job_running:auction:{$auction->id}");
            Cache::forget("countdown_job_heartbeat:auction:{$auction->id}");
            Cache::forget("countdown_job_finished:auction:{$auction->id}");

            // 世代番号を 0 にリセット（StartAuctionAction と揃える）
            Cache::put(ProcessAuctionCountdownJob::generationKey($auction->id), 0, ProcessAuctionCountdownJob::HEARTBEAT_TTL);

            // TTL はカウントダウンより必ず長く（StartAuctionAction と揃える）
            $cacheTtl = max(120, $countdownSeconds + 60);

            // 二重dispatch ガード: start_at を Cache::add で確保
            $added = Cache::add(
                "auction:{$auction->id}:start_at",
                now()->addSeconds($countdownSeconds)->timestamp,
                $cacheTtl
            );
            if (!$added) {
                Log::info("UpdateAuctionStatusAction.toLiveState: pre-start already in flight, skipping duplicate broadcast/dispatch", ['auction_id' => $auction->id]);
                return 'オークションを開始しました。';
            }

            Cache::put("auction:{$auction->id}:lanes_to_start", $lanesToStart, $cacheTtl);

            broadcast(new AuctionStatusChanged(
                $auction->id,
                'starting',
                'オークションが間もなく開始されます',
                $countdownSeconds
            ));

            ProcessAuctionCountdownJob::dispatch($auction->id);

            Log::info("Auction started via status change", ['auction_id' => $auction->id, 'lanes' => count($lanesToStart)]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Failed to start auction via status change", ['auction_id' => $auction->id, 'error' => $e->getMessage()]);
            return ['error' => 'オークション開始中にエラーが発生しました: ' . $e->getMessage()];
        }

        return 'オークションを開始しました。';
    }

    private function toFinishedState(Auction $auction): string|array
    {
        if (!$auction->finish()) {
            return ['error' => 'オークションを終了できません。'];
        }

        try {
            $sentCount = $this->notificationService->sendInvoiceReadyNotification($auction);
            Log::info("請求書発行LINE通知: {$sentCount}件", ['auction_id' => $auction->id]);
        } catch (\Exception $e) {
            Log::warning('請求書発行LINE通知でエラー', ['auction_id' => $auction->id, 'error' => $e->getMessage()]);
        }

        return 'オークションを終了しました。';
    }

    private function toCancelledState(Auction $auction): string|array
    {
        if (!$auction->cancel()) {
            return ['error' => 'オークションをキャンセルできません。'];
        }
        return 'オークションをキャンセルしました。';
    }
}
