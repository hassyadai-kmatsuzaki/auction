<?php

namespace Tests\Feature\Admin;

use App\Services\AwsScalingService;
use Mockery;
use Tests\TestCase;

/**
 * ScalingController のテスト。
 *
 * AWS API は実コールしない。AwsScalingService をモックに差し替えて
 * 認可（admin 専用）・バリデーション・ハッピーパス・例外時 409 を見る。
 */
class ScalingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_status_は_未認証で401(): void
    {
        $this->getJson('/api/admin/scaling/status')->assertStatus(401);
    }

    public function test_status_は_非adminで403(): void
    {
        $participant = $this->createParticipant();
        $this->actingAs($participant, 'sanctum')
            ->getJson('/api/admin/scaling/status')
            ->assertStatus(403);
    }

    public function test_status_は_AwsScalingServiceの結果を返す(): void
    {
        $this->mock(AwsScalingService::class, function ($m) {
            $m->shouldReceive('getStatus')->once()->andReturn([
                'mode' => 'normal',
                'instance_type' => 't3.small',
                'is_locked' => false,
                'last_action' => null,
            ]);
        });

        $admin = $this->createAdmin();
        $r = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/scaling/status');
        $r->assertOk()->assertJsonPath('success', true)
          ->assertJsonPath('data.mode', 'normal');
    }

    public function test_scaleUp_は_confirm未指定で422(): void
    {
        $admin = $this->createAdmin();
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/scaling/scale-up', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['confirm']);
    }

    public function test_scaleUp_は_AwsScalingService_scaleUpを呼び出す(): void
    {
        $admin = $this->createAdmin();
        $action = ['direction' => 'up', 'user_id' => $admin->id, 'started_at' => now()->toIso8601String(), 'status' => 'running'];

        $this->mock(AwsScalingService::class, function ($m) use ($admin, $action) {
            $m->shouldReceive('scaleUp')->once()->with($admin->id)->andReturn($action);
        });

        $r = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/scaling/scale-up', ['confirm' => 'SCALE_UP']);
        $r->assertOk()->assertJsonPath('success', true)
          ->assertJsonPath('data.direction', 'up');
    }

    public function test_scaleUp_は_例外で409(): void
    {
        $this->mock(AwsScalingService::class, function ($m) {
            $m->shouldReceive('scaleUp')->andThrow(new \RuntimeException('ロック中'));
        });

        $admin = $this->createAdmin();
        $r = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/scaling/scale-up', ['confirm' => 'SCALE_UP']);
        $r->assertStatus(409)->assertJsonPath('success', false);
    }

    public function test_scaleDown_は_confirmが正しい値以外で422(): void
    {
        $admin = $this->createAdmin();
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/scaling/scale-down', ['confirm' => 'WRONG'])
            ->assertStatus(422);
    }

    public function test_scaleDown_は_AwsScalingService_scaleDownを呼び出す(): void
    {
        $admin = $this->createAdmin();
        $this->mock(AwsScalingService::class, function ($m) use ($admin) {
            $m->shouldReceive('scaleDown')->once()->with($admin->id)->andReturn([
                'direction' => 'down', 'user_id' => $admin->id, 'started_at' => now()->toIso8601String(), 'status' => 'running',
            ]);
        });

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/scaling/scale-down', ['confirm' => 'SCALE_DOWN'])
            ->assertOk()
            ->assertJsonPath('data.direction', 'down');
    }

    public function test_releaseLock_は_AwsScalingService_releaseLockを呼ぶ(): void
    {
        $this->mock(AwsScalingService::class, function ($m) {
            $m->shouldReceive('releaseLock')->once();
        });

        $admin = $this->createAdmin();
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/scaling/release-lock')
            ->assertOk()
            ->assertJsonPath('success', true);
    }
}
