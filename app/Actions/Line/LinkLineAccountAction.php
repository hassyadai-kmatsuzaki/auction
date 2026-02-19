<?php

namespace App\Actions\Line;

use App\Models\LineAccount;
use App\Services\LineService;
use Illuminate\Support\Facades\Log;

class LinkLineAccountAction
{
    public function __construct(private readonly LineService $lineService) {}

    public function execute(int $userId, string $code): ?LineAccount
    {
        Log::info('LinkLineAccount: getting access token', ['user_id' => $userId]);

        $tokenData = $this->lineService->getAccessToken($code);
        if (!$tokenData || empty($tokenData['access_token'])) {
            Log::error('LinkLineAccount: failed to get access token', ['user_id' => $userId, 'response' => $tokenData]);
            return null;
        }

        Log::info('LinkLineAccount: getting profile');

        $profile = $this->lineService->getProfile($tokenData['access_token']);
        if (!$profile || empty($profile['userId'])) {
            Log::error('LinkLineAccount: failed to get profile', ['user_id' => $userId, 'response' => $profile]);
            return null;
        }

        Log::info('LinkLineAccount: saving to DB', [
            'user_id' => $userId,
            'line_user_id' => substr($profile['userId'], 0, 10) . '...',
        ]);

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
