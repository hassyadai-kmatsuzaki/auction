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

        $previousItem = $lane->currentItem;

        // A-6 (2026-09-08) 1/2: カウントダウンを止める「前」に確定できる状態かを見る。
        //   FinalizeBidAction は入札者が 2 名以上だと failure を返す。旧実装は戻り値を捨てて
        //   無条件に次商品へ進んでいたため、前商品が live のままレーンから外れて宙に浮いていた
        //   （運用ルール「入札者2名以上で押すな」でしか守れていなかった）。
        //   stopCountdown の後で失敗すると、商品は live のままカウントダウンだけ消えて
        //   レーンが止まるので、止める前に弾く。
        if ($previousItem && $previousItem->status === 'live') {
            $active = $this->bidParticipantRepo->countActiveByItem($previousItem->id);
            if ($active >= 2) {
                return AuctionResultDto::failure(
                    "入札者が {$active} 名いるため確定できません。価格上昇を待ってください。"
                );
            }
        }

        $this->countdown->stopCountdown($lane->id);

        DB::beginTransaction();
        try {
            $previousItemId = $lane->current_item_id;

            // 現在商品を落札確定
            if ($previousItem && $previousItem->status === 'live') {
                // A-6 2/2: 事前確認と確定の間に入札が入った場合の二重防御。
                //   失敗したら何も進めず、止めたカウントダウンを同じ商品で張り直す。
                $result = $this->finalize->execute($previousItem);
                if (!$result->success) {
                    DB::rollBack();
                    $this->restartCountdownAfterFailure($lane);
                    return AuctionResultDto::failure(
                        '現在の商品を確定できませんでした。' . $result->message
                    );
                }
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

    /**
     * A-6: 確定失敗時に、止めたカウントダウンを同じ商品で張り直す。
     *   残り秒数は初期値に戻る（表示だけの影響。入札データは変わらない）。
     *   張り直し自体が失敗してもレーンは tick 側の「cache 無し → recovery」経路で
     *   次イテレーションに復旧するので、ここでは例外を外へ出さない。
     */
    private function restartCountdownAfterFailure(Lane $lane): void
    {
        try {
            $fresh = $lane->fresh();
            if ($fresh) {
                $fresh->load(['auction', 'currentItem']);
                if ($fresh->currentItem && $fresh->currentItem->status === 'live') {
                    $this->countdown->startCountdown($fresh);
                }
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('MoveToNextItemAction: countdown restart after finalize failure failed', [
                'lane_id' => $lane->id, 'error' => $e->getMessage(),
            ]);
        }
    }
}
