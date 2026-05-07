<?php

namespace App\Actions\Auction;

use App\Events\AuctionStatusChanged;
use App\Jobs\ProcessAuctionCountdownJob;
use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * オークション開始アクション
 *
 * LiveController から複雑なビジネスロジックを切り出した版
 */
class StartAuctionAction
{
    private const PRE_START_COUNTDOWN = 10; // 秒

    public function execute(Auction $auction): void
    {
        if ($auction->status !== 'scheduled') {
            throw new \RuntimeException('このオークションは開始できません。（ステータス: ' . $auction->status . '）');
        }

        DB::beginTransaction();
        try {
            $this->ensureLanes($auction);
            $this->assignItems($auction);
            $auction->update(['status' => 'live']);

            $lanesToStart = [];
            foreach ($auction->lanes as $lane) {
                if ($this->startNextItem($lane, false)) {
                    $lanesToStart[] = $lane->id;
                }
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        // 古いロック・フラグが残っている場合はクリア（前回のオークションの残骸対策）
        // ※ start_at は Cache::add の二重dispatchガードとして使うので forget しない
        Cache::forget("countdown_job_lock:auction:{$auction->id}");
        Cache::forget("countdown_job_running:auction:{$auction->id}");
        Cache::forget("countdown_job_heartbeat:auction:{$auction->id}");
        Cache::forget("countdown_job_finished:auction:{$auction->id}");

        // 世代番号を0にリセット（新規開始なので古い世代の残骸をクリア）
        Cache::put(ProcessAuctionCountdownJob::generationKey($auction->id), 0, ProcessAuctionCountdownJob::HEARTBEAT_TTL);

        // 二重dispatch ガード: start_at を Cache::add で確保。
        // 既に存在 = 別経路で開始処理が in-flight → 上書きしない（フロントが「10→5→10」に戻る事故防止）
        $added = Cache::add(
            "auction:{$auction->id}:start_at",
            now()->addSeconds(self::PRE_START_COUNTDOWN)->timestamp,
            120
        );
        if (!$added) {
            Log::info("StartAuctionAction: pre-start already in flight, skipping duplicate broadcast/dispatch", ['auction_id' => $auction->id]);
            return;
        }

        Cache::put("auction:{$auction->id}:lanes_to_start", $lanesToStart, 120);
        broadcast(new AuctionStatusChanged($auction->id, 'starting', 'オークションが間もなく開始されます', self::PRE_START_COUNTDOWN));

        ProcessAuctionCountdownJob::dispatch($auction->id);
        Log::info("Dispatched auction countdown job for auction {$auction->id}");
    }

    private function ensureLanes(Auction $auction): void
    {
        $laneCount = $auction->lane_count ?: 1;

        $existing = $auction->lanes()->count();
        for ($i = $existing + 1; $i <= $laneCount; $i++) {
            Lane::create(['auction_id' => $auction->id, 'lane_number' => $i, 'status' => 'waiting']);
        }
    }

    private function assignItems(Auction $auction): void
    {
        // 既存の割り当て済みアイテムはスキップ
        $unassigned = Item::where('auction_id', $auction->id)
            ->where('status', 'registered')
            ->whereNotIn('id', function ($q) use ($auction) {
                $q->select('item_id')->from('lane_items')
                  ->join('lanes', 'lane_items.lane_id', '=', 'lanes.id')
                  ->where('lanes.auction_id', $auction->id);
            })
            ->orderBy('item_number')
            ->get();

        $lanes = $auction->lanes()->orderBy('lane_number')->get();
        if ($lanes->isEmpty() || $unassigned->isEmpty()) return;

        $laneCount = $lanes->count();
        foreach ($unassigned as $index => $item) {
            $lane = $lanes[$index % $laneCount];
            $maxOrder = \DB::table('lane_items')->where('lane_id', $lane->id)->max('sequence_order') ?? 0;
            \DB::table('lane_items')->insert([
                'lane_id'        => $lane->id,
                'item_id'        => $item->id,
                'sequence_order' => $maxOrder + 1,
                'created_at'     => now(),
                'updated_at'     => now(),
            ]);
        }
    }

    private function startNextItem(Lane $lane, bool $startCountdown = true): ?Item
    {
        $nextItem = $lane->items()->where('status', 'registered')->orderBy('lane_items.sequence_order')->first();
        if (!$nextItem) return null;

        $nextItem->update(['status' => 'live', 'current_price' => $nextItem->start_price]);
        $lane->update(['current_item_id' => $nextItem->id, 'status' => 'active']);

        return $nextItem;
    }
}
