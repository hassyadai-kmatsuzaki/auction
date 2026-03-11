<?php

namespace App\Actions\Bid;

use App\DTOs\BidResultDto;
use App\Events\BidderUpdated;
use App\Models\BidEvent;
use App\Models\BidParticipant;
use App\Models\Item;
use App\Models\Lane;
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

        DB::beginTransaction();
        try {
            $participant = BidParticipant::forItem($item->id)->forUser($userId)->first();
            if (!$participant || !$participant->is_active) {
                DB::rollBack();
                return BidResultDto::failure('入札に参加していません。');
            }

            // 最高入札者（落札権利者）は入札を解除できない
            $activeBidders = BidParticipant::forItem($item->id)->active()->count();
            if ($activeBidders === 1 && $participant->is_active) {
                DB::rollBack();
                return BidResultDto::failure('最高入札者は入札を解除できません。');
            }

            $participant->deactivate();
            BidEvent::recordLeave($item->id, $userId, $item->current_price, $ipAddress, $userAgent);
            $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        $auction = $item->auction;
        $lane    = Lane::where('current_item_id', $item->id)->first();
        if ($lane) {
            try {
                broadcast(new BidderUpdated($auction->id, $lane->id, $item->id, $activeBidderCount, 'left'))
                    ->toOthers();
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::warning("LeaveBid BidderUpdated broadcast error: " . $e->getMessage());
            }
        }

        return BidResultDto::success([
            'item_id'             => $item->id,
            'is_active'           => false,
            'current_price'       => $item->current_price,
            'active_bidder_count' => $activeBidderCount,
        ], '入札から離脱しました。');
    }
}
