<?php

namespace App\Repositories\Contracts;

use App\Models\BidParticipant;
use Illuminate\Support\Collection;

interface BidParticipantRepositoryInterface
{
    public function findByItemAndUser(int $itemId, int $userId): ?BidParticipant;

    public function countActiveByItem(int $itemId): int;

    public function getActiveByItem(int $itemId): Collection;

    public function participate(
        int     $itemId,
        int     $userId,
        bool    $isActive,
        ?string $ipAddress,
        ?string $userAgent,
    ): BidParticipant;

    public function deactivate(BidParticipant $participant): void;
}
