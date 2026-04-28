<?php

namespace Tests\Feature\Api;

use App\Services\ShippingTrackingService;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Api/TrackingController のテスト。
 *
 * ルート: GET /api/participant/tracking/{trackingNumber}
 * - participant ロールが必須 (admin / seller / 未認証は不可)
 * - carrier クエリで業者を強制指定できる
 * - 未指定時は ShippingTrackingService::detectCarrier() で自動判定
 */
class TrackingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Cache::flush();
    }

    public function test_participant_can_get_tracking_with_auto_carrier_detection(): void
    {
        $participant = $this->createParticipant();

        $this->mock(ShippingTrackingService::class, function ($m) {
            $m->shouldReceive('detectCarrier')
                ->once()
                ->with('123456789012')
                ->andReturn('yamato');
            $m->shouldReceive('getTrackingStatus')
                ->once()
                ->with('123456789012', 'yamato')
                ->andReturn([
                    'carrier' => 'yamato',
                    'tracking_number' => '123456789012',
                    'status' => 'in_transit',
                ]);
        });

        $r = $this->actingAs($participant, 'sanctum')
            ->getJson('/api/participant/tracking/123456789012');

        $r->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'in_transit')
            ->assertJsonPath('data.carrier', 'yamato');
    }

    public function test_participant_can_specify_carrier_via_query(): void
    {
        $participant = $this->createParticipant();

        $this->mock(ShippingTrackingService::class, function ($m) {
            $m->shouldNotReceive('detectCarrier');
            $m->shouldReceive('getTrackingStatus')
                ->once()
                ->with('ABC-001', 'sagawa')
                ->andReturn([
                    'carrier' => 'sagawa',
                    'tracking_number' => 'ABC-001',
                    'status' => 'delivered',
                ]);
        });

        $r = $this->actingAs($participant, 'sanctum')
            ->getJson('/api/participant/tracking/ABC-001?carrier=sagawa');

        $r->assertOk()
            ->assertJsonPath('data.status', 'delivered')
            ->assertJsonPath('data.carrier', 'sagawa');
    }

    public function test_admin_cannot_access_participant_tracking(): void
    {
        $admin = $this->createAdmin();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/participant/tracking/123456789012')
            ->assertStatus(403);
    }

    public function test_seller_cannot_access_participant_tracking(): void
    {
        $seller = $this->createSeller();

        $this->actingAs($seller, 'sanctum')
            ->getJson('/api/participant/tracking/123456789012')
            ->assertStatus(403);
    }

    public function test_unauthenticated_user_is_rejected(): void
    {
        $this->getJson('/api/participant/tracking/123456789012')
            ->assertStatus(401);
    }

    public function test_response_contract_includes_success_and_data(): void
    {
        $participant = $this->createParticipant();

        $this->mock(ShippingTrackingService::class, function ($m) {
            $m->shouldReceive('detectCarrier')->andReturn('other');
            $m->shouldReceive('getTrackingStatus')->andReturn([
                'carrier' => 'other',
                'tracking_number' => 'XYZ',
                'status' => 'unknown',
            ]);
        });

        $r = $this->actingAs($participant, 'sanctum')
            ->getJson('/api/participant/tracking/XYZ');

        $r->assertOk()
            ->assertJsonStructure([
                'success',
                'data' => ['carrier', 'tracking_number', 'status'],
            ]);
    }
}
