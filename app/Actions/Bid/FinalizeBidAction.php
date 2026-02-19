<?php

namespace App\Actions\Bid;

use App\DTOs\BidResultDto;
use App\Events\ItemSold;
use App\Models\BidEvent;
use App\Models\BidParticipant;
use App\Models\Item;
use App\Models\Lane;
use App\Models\PriceEvent;
use App\Models\WonItem;
use App\Services\NotificationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * 落札確定アクション
 *
 * 入札者数に応じて落札 or 不成立を確定する
 */
class FinalizeBidAction
{
    public function execute(Item $item): BidResultDto
    {
        if ($item->status !== 'live') {
            return BidResultDto::failure('この商品は現在ライブ中ではありません。');
        }

        $activeParticipants = BidParticipant::forItem($item->id)->active()->get();
        $activeBidderCount  = $activeParticipants->count();

        if ($activeBidderCount === 0) {
            return $this->finalizeAsUnsold($item);
        }

        if ($activeBidderCount === 1) {
            return $this->finalizeAsSold($item, $activeParticipants->first()->user_id);
        }

        return BidResultDto::failure('複数の入札者がいます。価格上昇を待ってください。', [
            'active_bidder_count' => $activeBidderCount,
        ]);
    }

    private function finalizeAsSold(Item $item, int $winnerId): BidResultDto
    {
        DB::beginTransaction();
        try {
            $auction        = $item->auction;
            $finalPrice     = $item->current_price;
            $totalBase      = $finalPrice * $item->quantity;
            $commissionRate = $auction->getFeeSettings()['buyer_commission_rate'];
            $commissionAmt  = $auction->calculateBuyerCommission($totalBase);
            $totalAmount    = $totalBase + $commissionAmt;
            $sellerAmt      = $totalBase - $auction->calculateSellerCommission($totalBase);

            $item->update(['status' => 'sold']);

            $wonItem = WonItem::create([
                'item_id'          => $item->id,
                'winner_id'        => $winnerId,
                'winning_price'    => $finalPrice,
                'quantity'         => $item->quantity,
                'total_amount'     => $totalAmount,
                'commission_rate'  => $commissionRate,
                'commission_amount'=> $commissionAmt,
                'seller_amount'    => $sellerAmt,
                'payment_status'   => 'pending',
                'delivery_status'  => 'pending',
                'payment_deadline' => now()->addHours($auction->payment_deadline_hours),
            ]);

            BidEvent::recordWin($item->id, $winnerId, $finalPrice);
            PriceEvent::recordItemSold($item->id, $finalPrice, $winnerId);

            $otherParticipants = BidParticipant::forItem($item->id)
                ->where('user_id', '!=', $winnerId)->get();
            foreach ($otherParticipants as $participant) {
                BidEvent::recordLose($item->id, $participant->user_id, $finalPrice);
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        // トランザクション外でブロードキャスト
        $lane = Lane::where('current_item_id', $item->id)->first();
        if ($lane) {
            broadcast(new ItemSold(
                $item->auction->id, $lane->id, $item->id,
                $winnerId, $finalPrice,
                $item->species_name ?? '', $item->item_number ?? 0, $item->quantity ?? 1
            ));
        }

        // 非同期通知（失敗してもオークション処理に影響しない）
        try {
            $notificationService = app(NotificationService::class);
            $notificationService->sendWonItemNotification($wonItem);
            $notificationService->sendItemSoldNotification($wonItem);
        } catch (\Exception $e) {
            Log::warning('落札通知でエラー（オークション処理には影響なし）', ['error' => $e->getMessage()]);
        }

        return BidResultDto::success([
            'item_id'       => $item->id,
            'winner_id'     => $winnerId,
            'winning_price' => $finalPrice,
            'total_amount'  => $totalAmount,
            'won_item_id'   => $wonItem->id,
        ], '落札が確定しました。');
    }

    private function finalizeAsUnsold(Item $item): BidResultDto
    {
        DB::beginTransaction();
        try {
            $item->update(['status' => 'unsold']);
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return BidResultDto::success([
            'item_id' => $item->id,
            'status'  => 'unsold',
        ], '入札者がいなかったため、不成立となりました。');
    }
}
