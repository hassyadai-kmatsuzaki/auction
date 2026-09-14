<?php

namespace Tests\Feature;

use App\Jobs\ProcessEneWebhookJob;
use App\Models\SystemSetting;
use App\Models\User;
use Tests\TestCase;

class EneWebhookDuplicateTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->assertTrue(SystemSetting::set('ene_duplicate_behavior', 'promote'));
    }

    public function test_promote_skips_user_suspended_by_admin(): void
    {
        // 管理画面の「停止」は is_active=true のまま status=suspended。Webhook の再送で承認済みに戻さない
        $user = $this->createParticipant();
        $user->update(['status' => 'suspended', 'is_active' => true]);

        $result = $this->handleDuplicate($user);

        $this->assertSame('skipped', $result['result']);
        $this->assertSame('suspended', $user->fresh()->status);
    }

    public function test_promote_still_approves_pending_user(): void
    {
        $user = $this->createParticipant();
        $user->update(['status' => 'pending', 'is_active' => true]);

        $result = $this->handleDuplicate($user);

        $this->assertSame('promoted', $result['result']);
        $this->assertSame('approved', $user->fresh()->status);
    }

    /**
     * @return array{user_id: ?int, result: string}
     */
    private function handleDuplicate(User $user): array
    {
        $job = new ProcessEneWebhookJob('test-delivery', []);

        return (new \ReflectionMethod($job, 'handleDuplicate'))->invoke($job, $user);
    }
}
