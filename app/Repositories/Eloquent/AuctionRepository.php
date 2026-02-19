<?php

namespace App\Repositories\Eloquent;

use App\Models\Auction;
use App\Repositories\Contracts\AuctionRepositoryInterface;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class AuctionRepository implements AuctionRepositoryInterface
{
    public function findById(int $id): ?Auction
    {
        return Auction::find($id);
    }

    public function findByIdOrFail(int $id): Auction
    {
        return Auction::findOrFail($id);
    }

    public function getLiveAuctions(): Collection
    {
        return Auction::where('status', 'live')
            ->with('lanes')
            ->orderBy('event_date')
            ->get();
    }

    public function getAdminList(array $filters = [], int $perPage = 20): LengthAwarePaginator
    {
        $query = Auction::query();

        if (!empty($filters['status'])) {
            is_array($filters['status'])
                ? $query->whereIn('status', $filters['status'])
                : $query->where('status', $filters['status']);
        }

        if (!empty($filters['search'])) {
            $query->where('title', 'like', "%{$filters['search']}%");
        }

        return $query->orderBy('event_date', 'desc')->paginate($perPage);
    }

    public function create(array $data): Auction
    {
        return Auction::create($data);
    }

    public function update(Auction $auction, array $data): Auction
    {
        $auction->update($data);
        return $auction->fresh();
    }

    public function updateStatus(Auction $auction, string $status): void
    {
        $auction->update(['status' => $status]);
    }
}
