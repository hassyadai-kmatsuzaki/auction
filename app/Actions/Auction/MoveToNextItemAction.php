<?php

namespace App\Actions\Auction;

use App\Actions\Bid\FinalizeBidAction;
use App\DTOs\AuctionResultDto;
use App\Events\LaneItemChanged;
use App\Models\Lane;
use App\Repositories\Contracts\BidParticipantRepositoryInterface;
use App\Repositories\Contracts\ItemRepositoryInterface;
use App\Repositories\Contracts\LaneRepositoryInterface;
use App\Services\CountdownService;
use Illuminate\Support\Facades\DB;

class MoveToNextItemAction
{
    public function __construct(
        private readonly CountdownService                  $countdown,
        private readonly FinalizeBidAction                 $finalize,
        private readonly BidParticipantRepositoryInterface $bidParticipantRepo,
        private readonly ItemRepositoryInterface           $itemRepo,
        private readonly LaneRepositoryInterface           $laneRepo,
    ) {}

    public function execute(Lane $lane): AuctionResultDto
    {
        $auction = $lane->auction;

        if ($auction->status !== 'live') {
            return AuctionResultDto::failure('オークションが開催中ではありません。');
        }

        $this->countdown->stopCountdown($lane->id);

        DB::beginTransaction();
        try {
            $previousItemId = $lane->current_item_id;
            $previousItem   = $lane->currentItem;

            // 現在商品を落札確定
            if ($previousItem && $previousItem->status === 'live') {
                $this->finalize->execute($previousItem);
            }

            // 次の商品をセット（カウントダウンはトランザクション外で開始）
            $nextItem = $this->itemRepo->getNextRegisteredForLane($lane->id);
            if ($nextItem) {
                $this->itemRepo->update($nextItem, [
                    'status'        => 'live',
                    'current_price' => $nextItem->start_price,
                ]);
                $this->laneRepo->update($lane, [
                    'current_item_id' => $nextItem->id,
                    'status'          => 'active',
                ]);
            } else {
                $this->laneRepo->update($lane, [
                    'current_item_id' => null,
                    'status'          => 'finished',
                ]);
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        // トランザクション外でカウントダウン開始（失敗してもDB整合性は保たれる）
        $currentItemData = null;
        if ($nextItem) {
            $lane->refresh()->load(['auction', 'currentItem']);
            $this->countdown->startPreBidCountdown($lane);

            $countdownState  = $this->countdown->getCountdownState($lane->id);
            $preBidRemaining = ($countdownState && ($countdownState['phase'] ?? '') === 'pre_bid')
                ? $countdownState['remaining_seconds'] : 0;

            $currentItemData = [
                'id'                       => $nextItem->id,
                'item_number'              => $nextItem->item_number,
                'species_name'             => $nextItem->species_name,
                'quantity'                 => $nextItem->quantity,
                'current_price'            => $nextItem->current_price,
                'is_premium'               => $nextItem->is_premium,
                'thumbnail_path'           => $nextItem->thumbnail_path,
                'active_bidders_count'     => $this->bidParticipantRepo->countActiveByItem($nextItem->id),
                'pre_bid_remaining_seconds'=> $preBidRemaining,
            ];
        }

        broadcast(new LaneItemChanged(
            $auction->id, $lane->id, $lane->lane_number,
            $lane->current_item_id, $currentItemData
        ));

        return AuctionResultDto::success(
            $nextItem ? '次の商品に進みました。' : 'レーンの全商品が終了しました。',
            ['next_item_id' => $nextItem?->id]
        );
    }
}
