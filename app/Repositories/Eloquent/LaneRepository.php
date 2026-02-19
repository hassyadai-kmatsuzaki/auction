<?php

namespace App\Repositories\Eloquent;

use App\Models\Lane;
use App\Repositories\Contracts\LaneRepositoryInterface;
use Illuminate\Support\Collection;

class LaneRepository implements LaneRepositoryInterface
{
    public function findById(int $id): ?Lane
    {
        return Lane::find($id);
    }

    public function findByIdOrFail(int $id): Lane
    {
        return Lane::findOrFail($id);
    }

    public function getByAuction(int $auctionId): Collection
    {
        return Lane::where('auction_id', $auctionId)
            ->with(['currentItem.media'])
            ->orderBy('lane_number')
            ->get();
    }

    public function getActiveByAuction(int $auctionId): Collection
    {
        return Lane::where('auction_id', $auctionId)
            ->where('status', 'active')
            ->get();
    }

    public function findByCurrentItem(int $itemId): ?Lane
    {
        return Lane::where('current_item_id', $itemId)->first();
    }

    public function create(array $data): Lane
    {
        return Lane::create($data);
    }

    public function update(Lane $lane, array $data): Lane
    {
        $lane->update($data);
        return $lane->fresh();
    }

    public function updateStatusByAuction(int $auctionId, string $fromStatus, string $toStatus): void
    {
        Lane::where('auction_id', $auctionId)
            ->where('status', $fromStatus)
            ->update(['status' => $toStatus]);
    }
}
