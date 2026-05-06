<?php

namespace App\Actions\Bid;

use App\DTOs\BidResultDto;
use App\Events\ItemSold;
use App\Models\BidEvent;
use App\Models\BidParticipant;
use App\Models\Item;
use App\Models\Lane;
use App\Models\PriceEvent;
use App\Models\User;
use App\Models\WonItem;
use App\Services\Monitoring\MetricRecorder;
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

            // 落札者の登録住所をデフォルト配送先としてコピー（配送料はオークション終了時に一括計算）
            $winner = User::find($winnerId);
            $shippingData = [];
            if ($winner && $winner->prefecture) {
                $shippingData = [
                    'shipping_postal_code'  => $winner->postal_code,
                    'shipping_prefecture'   => $winner->prefecture,
                    'shipping_city'         => $winner->city,
                    'shipping_address_line1' => $winner->address_line1,
                    'shipping_address_line2' => $winner->address_line2,
                    'shipping_name'         => $winner->name,
                    'shipping_phone'        => $winner->phone,
                ];
            }

            $wonItem = WonItem::create(array_merge([
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
                // 開催が木・金前提のため、落札時点から見た「次の水曜 23:59」を一律期限とする。
                // auctions.payment_deadline_hours は当面参照しない（営業日対応するまでの暫定運用）。
                'payment_deadline' => now()->next(\Carbon\Carbon::WEDNESDAY)->endOfDay(),
            ], $shippingData));

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

        app(MetricRecorder::class)->itemSold($item->id, $winnerId, (float) $finalPrice);

        // ─── 外側トランザクション完了後にブロードキャスト ─────────────
        // CountdownService::handleCountdownEnd から呼ばれる場合、本メソッドは
        // ネストした内側トランザクションになる。内側 commit 時点ではまだ外側が
        // commit されていないので、ItemSold を即時 broadcast すると、受信した
        // クライアントが GET で読みに行った時に「sold が反映されていない」状態を
        // 観測する可能性がある。DB::afterCommit() で本当に永続化された後に流す。
        $lane = Lane::where('current_item_id', $item->id)->first();
        if ($lane) {
            $auctionId = $item->auction->id;
            $laneId = $lane->id;
            $itemId = $item->id;
            $speciesName = $item->species_name ?? '';
            $itemNumber = $item->item_number ?? 0;
            $quantity = $item->quantity ?? 1;
            DB::afterCommit(function () use ($auctionId, $laneId, $itemId, $winnerId, $finalPrice, $speciesName, $itemNumber, $quantity) {
                try {
                    broadcast(new ItemSold(
                        $auctionId, $laneId, $itemId,
                        $winnerId, $finalPrice,
                        $speciesName, $itemNumber, $quantity
                    ));
                } catch (\Exception $e) {
                    Log::warning("ItemSold broadcast error: " . $e->getMessage());
                    app(MetricRecorder::class)->broadcastFailure('ItemSold', $e->getMessage());
                }
            });
        }

        // 非同期通知（失敗してもオークション処理に影響しない）
        // 通知も commit 後にすべき（commit 失敗時に「落札しました」LINE が飛んだら整合崩壊）
        DB::afterCommit(function () use ($wonItem) {
            try {
                $notificationService = app(NotificationService::class);
                $notificationService->sendWonItemNotification($wonItem);
                $notificationService->sendItemSoldNotification($wonItem);
            } catch (\Exception $e) {
                Log::warning('落札通知でエラー（オークション処理には影響なし）', ['error' => $e->getMessage()]);
            }
        });

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

        app(MetricRecorder::class)->itemUnsold($item->id);

        return BidResultDto::success([
            'item_id' => $item->id,
            'status'  => 'unsold',
        ], '入札者がいなかったため、不成立となりました。');
    }
}
