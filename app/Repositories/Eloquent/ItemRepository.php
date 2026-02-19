<?php

namespace App\Repositories\Eloquent;

use App\Models\Item;
use App\Repositories\Contracts\ItemRepositoryInterface;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class ItemRepository implements ItemRepositoryInterface
{
    public function findById(int $id): ?Item
    {
        return Item::find($id);
    }

    public function findByIdOrFail(int $id): Item
    {
        return Item::findOrFail($id);
    }

    public function getByAuction(int $auctionId, array $filters = [], int $perPage = 20): LengthAwarePaginator
    {
        $query = Item::where('auction_id', $auctionId)->with('media');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (!empty($filters['search'])) {
            $query->where('species_name', 'like', "%{$filters['search']}%");
        }

        return $query->orderBy('item_number')->paginate($perPage);
    }

    public function getNextRegisteredForLane(int $laneId): ?Item
    {
        return Item::join('lane_items', 'items.id', '=', 'lane_items.item_id')
            ->where('lane_items.lane_id', $laneId)
            ->where('items.status', 'registered')
            ->orderBy('lane_items.sequence_order')
            ->select('items.*')
            ->first();
    }

    public function create(array $data): Item
    {
        return Item::create($data);
    }

    public function update(Item $item, array $data): Item
    {
        $item->update($data);
        return $item->fresh();
    }

    public function delete(Item $item): void
    {
        $item->delete();
    }

    public function getMaxItemNumber(int $auctionId): int
    {
        return (int) (Item::where('auction_id', $auctionId)->max('item_number') ?? 0);
    }
}
