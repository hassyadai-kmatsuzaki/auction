<?php

namespace App\Actions\Bid;

use App\DTOs\BidResultDto;
use App\Events\BidderUpdated;
use App\Models\BidEvent;
use App\Models\BidParticipant;
use App\Models\Item;
use App\Models\Lane;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * 入札離脱アクション
 *
 * 単一責任: 入札OFFのユースケースのみを担当
 */
class LeaveBidAction
{
    public function execute(
        Item    $item,
        int     $userId,
        ?string $ipAddress = null,
        ?string $userAgent = null,
    ): BidResultDto {
        if ($item->status !== 'live') {
            return BidResultDto::failure('この商品は現在入札を受け付けていません。');
        }

        // 同じ item に対する同時 Join/Leave を Redis レベルで直列化
        $bidLock = Cache::lock("bid_inflight:item:{$item->id}", 5);
        if (!$bidLock->get()) {
            return BidResultDto::failure('現在他のユーザーの入札を処理中です。少しお待ちください。');
        }

        try {

        // ─── ロック順序プロトコル ─────────────────────────────────
        // items(行ロック) → bid_participants → bid_events の順で取得し、
        // handlePriceIncrement / JoinBidAction / adjustPriceByBidLimits と
        // 同じロック順を守ることでデッドロックを回避する。
        $tx = DB::transaction(function () use ($item, $userId, $ipAddress, $userAgent) {
            $locked = Item::where('id', $item->id)->lockForUpdate()->first();
            if (!$locked || $locked->status !== 'live') {
                return ['fail' => 'この商品は現在入札を受け付けていません。'];
            }

            $participant = BidParticipant::forItem($locked->id)->forUser($userId)->first();
            if (!$participant || !$participant->is_active) {
                return ['fail' => '入札に参加していません。'];
            }

            // 最高入札者（落札権利者）は入札を解除できない
            $activeBidders = BidParticipant::forItem($locked->id)->active()->count();
            if ($activeBidders === 1 && $participant->is_active) {
                return ['fail' => '最高入札者は入札を解除できません。'];
            }

            $participant->deactivate();
            BidEvent::recordLeave($locked->id, $userId, (float) $locked->current_price, $ipAddress, $userAgent);
            $activeBidderCount = BidParticipant::forItem($locked->id)->active()->count();

            return [
                'active_bidder_count' => $activeBidderCount,
                'current_price'       => (float) $locked->current_price,
            ];
        }, 3);

        if (isset($tx['fail'])) {
            return BidResultDto::failure($tx['fail']);
        }
        $activeBidderCount = $tx['active_bidder_count'];

        $auction = $item->auction;
        $lane    = Lane::where('current_item_id', $item->id)->first();
        if ($lane) {
            try {
                broadcast(new BidderUpdated($auction->id, $lane->id, $item->id, $activeBidderCount, 'left'))
                    ->toOthers();
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::warning("LeaveBid BidderUpdated broadcast error: " . $e->getMessage());
                app(\App\Services\Monitoring\MetricRecorder::class)->broadcastFailure('BidderUpdated', $e->getMessage());
            }
        }

        return BidResultDto::success([
            'item_id'             => $item->id,
            'is_active'           => false,
            'current_price'       => $item->current_price,
            'active_bidder_count' => $activeBidderCount,
        ], '入札から離脱しました。');

        } finally {
            optional($bidLock)->release();
        }
    }
}
