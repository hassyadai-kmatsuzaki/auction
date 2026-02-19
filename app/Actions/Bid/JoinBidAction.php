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
 * 入札参加アクション
 *
 * 単一責任: 入札ONのユースケースのみを担当
 */
class JoinBidAction
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

        $auction = $item->auction;
        if ($auction->status !== 'live') {
            return BidResultDto::failure('オークションが開催中ではありません。');
        }

        // 入札開始待機フェーズ中は入札不可
        $lane = Lane::where('current_item_id', $item->id)->first();
        if ($lane) {
            $countdownState = Cache::get("countdown:lane:{$lane->id}");
            if ($countdownState && ($countdownState['phase'] ?? 'bidding') === 'pre_bid') {
                return BidResultDto::failure(
                    '入札開始待機中です。もう少々お待ちください。',
                    ['pre_bid_remaining_seconds' => $countdownState['remaining_seconds'] ?? 0]
                );
            }
        }

        DB::beginTransaction();
        try {
            $participant = BidParticipant::participate($item->id, $userId, true, $ipAddress, $userAgent);
            BidEvent::recordJoin($item->id, $userId, $item->current_price, $ipAddress, $userAgent);
            $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        // トランザクション外でブロードキャスト（失敗してもロールバックしない）
        if ($lane) {
            broadcast(new BidderUpdated($auction->id, $lane->id, $item->id, $activeBidderCount, 'joined'))
                ->toOthers();
        }

        return BidResultDto::success([
            'participant_id'      => $participant->id,
            'item_id'             => $item->id,
            'is_active'           => true,
            'current_price'       => $item->current_price,
            'active_bidder_count' => $activeBidderCount,
        ], '入札に参加しました。');
    }
}
