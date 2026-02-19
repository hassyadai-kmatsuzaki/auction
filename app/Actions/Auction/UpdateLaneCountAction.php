<?php

namespace App\Actions\Auction;

use App\DTOs\AuctionResultDto;
use App\Models\Auction;
use Illuminate\Support\Facades\DB;

/**
 * レーン数更新アクション
 */
class UpdateLaneCountAction
{
    public function execute(Auction $auction, int $newLaneCount): AuctionResultDto
    {
        if (in_array($auction->status, ['finished', 'cancelled'])) {
            return AuctionResultDto::failure('終了済みまたはキャンセル済みのオークションは変更できません。');
        }

        if ($auction->status === 'live') {
            return AuctionResultDto::failure('開催中のオークションのレーン数は変更できません。');
        }

        $oldLaneCount = $auction->lane_count;

        // レーン数を減らす場合: 削除対象レーンのアイテムを解除してから削除
        if ($newLaneCount < $oldLaneCount) {
            $lanesToRemove = $auction->lanes()
                ->where('lane_number', '>', $newLaneCount)
                ->pluck('id');

            if ($lanesToRemove->isNotEmpty()) {
                DB::table('lane_items')->whereIn('lane_id', $lanesToRemove)->delete();
                $auction->lanes()->whereIn('id', $lanesToRemove)->delete();
            }
        }

        $auction->update(['lane_count' => $newLaneCount]);

        // レーン数が増えた場合は新規レーンを作成
        if ($newLaneCount > $oldLaneCount) {
            $maxLaneNumber = $auction->lanes()->max('lane_number') ?? 0;
            for ($i = $maxLaneNumber + 1; $i <= $maxLaneNumber + ($newLaneCount - $oldLaneCount); $i++) {
                $auction->lanes()->firstOrCreate(
                    ['lane_number' => $i],
                    ['status' => 'waiting']
                );
            }
        }

        return AuctionResultDto::success('レーン数を更新しました。', [
            'auction_id' => $auction->id,
            'lane_count' => $newLaneCount,
        ]);
    }
}
