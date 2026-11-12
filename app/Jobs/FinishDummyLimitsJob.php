<?php

namespace App\Jobs;

use App\Events\BidLimitsBatchTriggered;
use App\Models\BidLimitPrice;
use App\Models\Item;
use App\Models\Lane;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * 商品開始後に、表示専用のダミー指値（is_top_rank=0）を終了扱いにして消し、
 * 持ち主に敗退通知を送る（2026-11-12・上位2件だけ計算対象）。
 *
 * - items のロックを取らない（開始時のロック内処理を増やさないのが目的）
 * - 計算対象（is_top_rank=1）の行には絶対に触らない。触ると、参加中の人の上限が消えて
 *   上限なしで入札し続ける事故になる
 * - 失敗しても落札結果に影響しない（通知と会場のチップ更新が遅れるだけ）
 */
class FinishDummyLimitsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 60;

    public function __construct(public int $itemId)
    {
        $this->onQueue('notify');
    }

    public function handle(): void
    {
        $item = Item::find($this->itemId);
        if (!$item) {
            return;
        }

        $rows = BidLimitPrice::where('item_id', $this->itemId)
            ->where('is_top_rank', false)
            ->where('is_triggered', false)
            ->get(['id', 'user_id', 'limit_price']);
        if ($rows->isEmpty()) {
            return;
        }

        $ids = $rows->pluck('id')->all();
        // is_top_rank=0 を WHERE に固定（計算対象の行を巻き込まない）
        BidLimitPrice::whereIn('id', $ids)->where('is_top_rank', false)->update([
            'is_triggered' => true,
            'triggered_at' => now(),
            'updated_at'   => now(),
        ]);
        BidLimitPrice::whereIn('id', $ids)->where('is_top_rank', false)->delete();

        $currentPrice = (float) $item->current_price;
        $speciesName  = $item->species_name ?? '商品';
        Log::info("FinishDummyLimitsJob: item={$this->itemId}, finished={$rows->count()} dummy limits");

        // 会場の「上限 ¥X」チップを消す（既存の batch イベントを流用）
        $lane = Lane::where('current_item_id', $this->itemId)->first();
        if ($lane && $item->auction_id) {
            try {
                broadcast(new BidLimitsBatchTriggered(
                    (int) $item->auction_id,
                    (int) $lane->id,
                    $this->itemId,
                    $currentPrice,
                    $rows->map(fn ($r) => [
                        'user_id'     => (int) $r->user_id,
                        'limit_price' => (float) $r->limit_price,
                        'action'      => 'triggered',
                        'protected'   => false,
                    ])->values()->all(),
                ));
            } catch (\Throwable $e) {
                Log::warning('FinishDummyLimitsJob broadcast error: ' . $e->getMessage());
            }
        }

        // 敗退通知（既存の敗者通知と同じ文面・同じチャンク）
        $targets = $rows->map(fn ($r) => [
            '_notify_user_id' => (int) $r->user_id,
            '_notify_limit'   => (float) $r->limit_price,
        ])->values()->all();
        foreach (array_chunk($targets, 20) as $chunk) {
            try {
                NotifyBidLimitChunkJob::dispatch($this->itemId, $speciesName, $currentPrice, $chunk);
            } catch (\Throwable $e) {
                Log::warning('FinishDummyLimitsJob notify dispatch error: ' . $e->getMessage());
            }
        }
    }
}
