<?php

namespace App\Repositories\Eloquent;

use App\Models\BidParticipant;
use App\Repositories\Contracts\BidParticipantRepositoryInterface;
use Illuminate\Support\Collection;

class BidParticipantRepository implements BidParticipantRepositoryInterface
{
    public function findByItemAndUser(int $itemId, int $userId): ?BidParticipant
    {
        return BidParticipant::where('item_id', $itemId)
            ->where('user_id', $userId)
            ->first();
    }

    public function countActiveByItem(int $itemId): int
    {
        return BidParticipant::where('item_id', $itemId)
            ->where('is_active', true)
            ->count();
    }

    public function getActiveByItem(int $itemId): Collection
    {
        return BidParticipant::where('item_id', $itemId)
            ->where('is_active', true)
            ->get();
    }

    public function participate(
        int     $itemId,
        int     $userId,
        bool    $isActive,
        ?string $ipAddress,
        ?string $userAgent,
    ): BidParticipant {
        return BidParticipant::updateOrCreate(
            ['item_id' => $itemId, 'user_id' => $userId],
            [
                'is_active'  => $isActive,
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'activated_at' => $isActive ? now() : null,
            ]
        );
    }

    public function deactivate(BidParticipant $participant): void
    {
        $participant->update(['is_active' => false]);
    }
}
