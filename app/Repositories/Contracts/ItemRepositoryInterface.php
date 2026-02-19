<?php

namespace App\Repositories\Contracts;

use App\Models\Item;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface ItemRepositoryInterface
{
    public function findById(int $id): ?Item;

    public function findByIdOrFail(int $id): Item;

    public function getByAuction(int $auctionId, array $filters = [], int $perPage = 20): LengthAwarePaginator;

    public function getNextRegisteredForLane(int $laneId): ?Item;

    public function create(array $data): Item;

    public function update(Item $item, array $data): Item;

    public function delete(Item $item): void;

    public function getMaxItemNumber(int $auctionId): int;
}
