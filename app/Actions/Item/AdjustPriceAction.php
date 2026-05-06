<?php

namespace App\Actions\Item;

use App\DTOs\AuctionResultDto;
use App\Events\PriceUpdated;
use App\Models\BidParticipant;
use App\Models\Item;
use App\Models\Lane;
use App\Models\PriceEvent;
use App\Services\CountdownService;
use Illuminate\Support\Facades\Log;

/**
 * 管理者による手動価格調整アクション
 */
class AdjustPriceAction
{
    public function execute(Item $item, float $newPrice, ?string $reason = null, ?int $adminId = null): AuctionResultDto
    {
        if ($item->status !== 'live') {
            return AuctionResultDto::failure('ライブ中の商品のみ価格調整できます。');
        }

        $oldPrice = $item->current_price;
        $item->update(['current_price' => $newPrice]);

        PriceEvent::recordManualAdjustment(
            $item->id,
            $oldPrice,
            $newPrice,
            $adminId,
            ['reason' => $reason ?? '手動調整']
        );

        $lane = Lane::where('current_item_id', $item->id)->first();
        if ($lane) {
            $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();
            broadcast(new PriceUpdated(
                $item->auction->id, $lane->id, $item->id,
                $newPrice, $activeBidderCount,
                $item->auction->countdown_seconds
            ));

            // 包含的上限の整合: 手動調整で「current_price > limit_price」となる指値者を一括発動・削除する。
            // 通常の price increment 経路では handlePriceIncrement が checkBidLimits を呼ぶが、
            // AdjustPriceAction はそこを通らないため指値レコードがクリーンアップされない事故が起きていた。
            try {
                app(CountdownService::class)->checkBidLimits($lane, $item->fresh(), $item->auction);
            } catch (\Exception $e) {
                Log::warning("checkBidLimits after AdjustPrice failed: item={$item->id} - " . $e->getMessage());
            }
        }

        return AuctionResultDto::success('価格を調整しました。', [
            'item_id'   => $item->id,
            'old_price' => $oldPrice,
            'new_price' => $newPrice,
        ]);
    }
}
