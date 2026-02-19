<?php

namespace App\Actions\Auction;

use App\DTOs\AuctionResultDto;
use App\Events\AuctionStatusChanged;
use App\Models\Auction;
use Illuminate\Support\Facades\DB;

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

        broadcast(new AuctionStatusChanged($auction->id, 'finished', 'オークションが終了しました'));

        return AuctionResultDto::success('オークションを終了しました。');
    }
}
