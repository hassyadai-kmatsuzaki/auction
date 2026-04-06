<?php

namespace App\Actions\Auction;

use App\DTOs\AuctionResultDto;
use App\Events\AuctionStatusChanged;
use App\Models\Auction;
use App\Models\WonItem;
use App\Services\ShippingCalculatorService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class FinishAuctionAction
{
    public function execute(Auction $auction): AuctionResultDto
    {
        if ($auction->status !== 'live') {
            return AuctionResultDto::failure('開催中のオークションのみ終了できます。');
        }

        DB::beginTransaction();
        try {
            $auction->items()->where('status', 'live')->update(['status' => 'unsold']);
            $auction->lanes()->update(['status' => 'finished', 'current_item_id' => null]);
            $auction->update(['status' => 'finished', 'end_time' => now()->format('H:i:s')]);
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        // 送料計算はボタン方式に移行（自動計算しない）

        broadcast(new AuctionStatusChanged($auction->id, 'finished', 'オークションが終了しました'));

        return AuctionResultDto::success('オークションを終了しました。');
    }

    /**
     * オークションの落札者ごとに配送料を一括計算
     *
     * 同一落札者の全商品をまとめてビンパッキングし、配送料を按分して各WonItemに設定する。
     */
    public function calculateShippingForAuction(Auction $auction): void
    {
        try {
            $calculator = app(ShippingCalculatorService::class);

            // このオークションの全落札商品を落札者ごとにグループ化
            $wonItems = WonItem::whereHas('item', function ($q) use ($auction) {
                $q->where('auction_id', $auction->id);
            })->with('item')->get();

            $grouped = $wonItems->groupBy('winner_id');

            foreach ($grouped as $winnerId => $winnerItems) {
                // 配送先の都道府県を取得（最初のWonItemの配送先を使用）
                $prefecture = $winnerItems->first()->shipping_prefecture;
                if (!$prefecture) {
                    continue;
                }

                $region = $calculator->getRegionByPrefecture($prefecture);
                if (!$region) {
                    continue;
                }

                // 全落札商品の数量をまとめて計算
                $items = $winnerItems->map(function ($wonItem) {
                    return ['quantity' => $wonItem->item->quantity];
                })->values()->toArray();

                $result = $calculator->calculate($items, $region);
                $totalFee = $result['total_shipping_fee'];

                // 配送料を数量比で按分
                $totalQuantity = $winnerItems->sum(fn($wi) => $wi->item->quantity);

                foreach ($winnerItems as $wonItem) {
                    $ratio = $wonItem->item->quantity / $totalQuantity;
                    $wonItem->update([
                        'shipping_fee' => (int) round($totalFee * $ratio),
                        'shipping_breakdown' => $result,
                    ]);
                }
            }
        } catch (\Exception $e) {
            Log::warning('オークション終了時の配送料一括計算に失敗', [
                'auction_id' => $auction->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
