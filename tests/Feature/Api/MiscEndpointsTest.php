<?php

namespace Tests\Feature\Api;

use App\Models\Announcement;
use App\Models\Item;
use App\Models\PedigreeCertificate;
use App\Models\SellerProfile;
use App\Models\User;
use App\Services\PedigreeCertificateService;
use App\Services\ShippingTrackingService;
use Mockery;
use Tests\TestCase;

/**
 * Tier 4 補助エンドポイントの Feature テスト。
 *
 * - Tutorial / Manual / Tracking / Pedigree / UserAnnouncement / ShippingCalculate
 */
class MiscEndpointsTest extends TestCase
{
    private User $participant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->participant = $this->createParticipant();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    // ========== Tutorial ==========

    public function test_tutorial_index_returns_steps_for_role(): void
    {
        $r = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/tutorials?role=participant');
        $r->assertOk()->assertJsonStructure(['data' => [['id', 'title', 'description', 'completed']]]);
    }

    public function test_tutorial_complete_marks_step(): void
    {
        $r = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/tutorials/complete', ['step_id' => 'p_welcome']);
        $r->assertOk();

        $settings = $this->participant->fresh()->notification_settings ?? [];
        $this->assertContains('p_welcome', $settings['completed_tutorials'] ?? []);
    }

    public function test_tutorial_complete_validates_step_id(): void
    {
        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/tutorials/complete', [])
            ->assertStatus(422);
    }

    // ========== Manual ==========

    public function test_manuals_index_returns_list(): void
    {
        $r = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/manuals');
        $r->assertOk()
            ->assertJsonStructure(['data' => ['manuals']]);
    }

    public function test_manuals_show_returns_404_for_unknown_id(): void
    {
        $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/manuals/non-existent')
            ->assertStatus(404);
    }

    // ========== Tracking ==========

    public function test_tracking_show(): void
    {
        $this->mock(ShippingTrackingService::class, function ($m) {
            $m->shouldReceive('detectCarrier')->andReturn('yamato');
            $m->shouldReceive('getTrackingStatus')->andReturn(['status' => 'in_transit']);
        });

        $r = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/participant/tracking/1234-5678-9012');
        $r->assertOk()
            ->assertJsonPath('data.status', 'in_transit');
    }

    // ========== Pedigree ==========

    public function test_pedigree_show_returns_null_when_missing(): void
    {
        $admin = $this->createAdmin();
        $r = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/pedigree/999999');
        $r->assertOk();
        $this->assertNull($r->json('data'));
    }

    public function test_pedigree_show_returns_certificate(): void
    {
        $admin = $this->createAdmin();
        $auction = \App\Models\Auction::factory()->create(['created_by' => $admin->id]);
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
        $item = Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);
        PedigreeCertificate::create([
            'item_id' => $item->id,
            'certificate_number' => 'PED-001',
            'breed_name' => '幹之メダカ',
            'status' => 'draft',
            'issued_by' => $admin->id,
        ]);

        $r = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/pedigree/{$item->id}");
        $r->assertOk();
        $this->assertSame('PED-001', $r->json('data.certificate_number'));
    }

    public function test_pedigree_store_validates_inputs(): void
    {
        $admin = $this->createAdmin();
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/pedigree', [])
            ->assertStatus(422);
    }

    public function test_pedigree_issue(): void
    {
        $admin = $this->createAdmin();
        $auction = \App\Models\Auction::factory()->create(['created_by' => $admin->id]);
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
        $item = Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);
        $cert = PedigreeCertificate::create([
            'item_id' => $item->id,
            'certificate_number' => 'PED-002',
            'breed_name' => 'X',
            'status' => 'draft',
            'issued_by' => $admin->id,
        ]);

        $this->mock(PedigreeCertificateService::class, function ($m) use ($cert) {
            $m->shouldReceive('issue')->once()->with(Mockery::on(fn ($c) => $c->id === $cert->id));
        });

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/pedigree/{$cert->id}/issue")
            ->assertOk();
    }

    // ========== UserAnnouncement ==========

    public function test_user_announcement_index(): void
    {
        Announcement::factory()->create([
            'target_roles' => ['participant', 'seller'],
            'status' => 'published',
            'published_at' => now()->subDay(),
        ]);

        $r = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/announcements');
        $r->assertOk()
            ->assertJsonStructure(['data' => ['announcements', 'pagination']]);
    }

    public function test_user_announcement_show_403_when_invisible(): void
    {
        // 出品者向けのお知らせを参加者が見ようとして 403
        $a = Announcement::factory()->create([
            'target_roles' => ['seller'],
            'status' => 'published',
            'published_at' => now()->subDay(),
        ]);

        $this->actingAs($this->participant, 'sanctum')
            ->getJson("/api/announcements/{$a->id}")
            ->assertStatus(403);
    }

    // ========== ShippingCalculate ==========

    public function test_shipping_calculate_validates_input(): void
    {
        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/shipping/calculate', [])
            ->assertStatus(422);
    }

    public function test_shipping_calculate_works_with_prefecture(): void
    {
        $r = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/shipping/calculate', [
                'items' => [['quantity' => 10]],
                'destination_prefecture' => '東京都',
            ]);
        $r->assertOk()
            ->assertJsonStructure(['data' => ['calculation_mode', 'total_shipping_fee']]);
    }

    public function test_shipping_calculate_unknown_prefecture_422(): void
    {
        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/shipping/calculate', [
                'items' => [['quantity' => 10]],
                'destination_prefecture' => '存在しない県',
            ])
            ->assertStatus(422);
    }

    public function test_shipping_calculate_requires_authentication(): void
    {
        $this->postJson('/api/shipping/calculate', [
            'items' => [['quantity' => 10]],
            'destination_region' => '関東',
        ])->assertStatus(401);
    }
}
