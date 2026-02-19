<?php

namespace App\Actions\Line;

use App\Models\LineAccount;
use App\Services\LineService;

class LinkLineAccountAction
{
    public function __construct(private readonly LineService $lineService) {}

    public function execute(int $userId, string $code): ?LineAccount
    {
        $tokenData = $this->lineService->getAccessToken($code);
        if (!$tokenData || empty($tokenData['access_token'])) return null;

        $profile = $this->lineService->getProfile($tokenData['access_token']);
        if (!$profile || empty($profile['userId'])) return null;

        return LineAccount::updateOrCreate(
            ['user_id' => $userId],
            [
                'line_user_id' => $profile['userId'],
                'display_name' => $profile['displayName'] ?? null,
                'picture_url'  => $profile['pictureUrl'] ?? null,
                'is_active'    => true,
                'linked_at'    => now(),
            ]
        );
    }
}
