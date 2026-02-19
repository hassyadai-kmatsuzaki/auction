<?php

namespace App\Repositories\Contracts;

use App\Models\Auction;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface AuctionRepositoryInterface
{
    public function findById(int $id): ?Auction;

    public function findByIdOrFail(int $id): Auction;

    public function getLiveAuctions(): Collection;

    public function getAdminList(array $filters = [], int $perPage = 20): LengthAwarePaginator;

    public function create(array $data): Auction;

    public function update(Auction $auction, array $data): Auction;

    public function updateStatus(Auction $auction, string $status): void;
}
