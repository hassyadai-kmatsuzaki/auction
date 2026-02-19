<?php

namespace App\Repositories\Contracts;

use App\Models\Lane;
use Illuminate\Support\Collection;

interface LaneRepositoryInterface
{
    public function findById(int $id): ?Lane;

    public function findByIdOrFail(int $id): Lane;

    public function getByAuction(int $auctionId): Collection;

    public function getActiveByAuction(int $auctionId): Collection;

    public function findByCurrentItem(int $itemId): ?Lane;

    public function create(array $data): Lane;

    public function update(Lane $lane, array $data): Lane;

    public function updateStatusByAuction(int $auctionId, string $fromStatus, string $toStatus): void;
}
