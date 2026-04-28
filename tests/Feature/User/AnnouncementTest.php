<?php

namespace Tests\Feature\User;

use App\Models\Announcement;
use App\Models\User;
use Tests\TestCase;

/**
 * UserAnnouncementController のテスト。
 *
 * - GET /api/announcements      ロール対象のみ表示
 * - GET /api/announcements/{id} 表示不可なら 403
 */
class AnnouncementTest extends TestCase
{
    private User $participant;
    private User $seller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->participant = $this->createParticipant();
        $this->seller = $this->createSeller();
    }

    public function test_index_は_未認証で401(): void
    {
        $this->getJson('/api/announcements')->assertStatus(401);
    }

    public function test_index_は_対象ロール向けお知らせのみを返す(): void
    {
        Announcement::factory()->create([
            'target_roles' => ['participant'],
            'status' => 'published',
            'published_at' => now()->subDay(),
        ]);
        Announcement::factory()->create([
            'target_roles' => ['seller'],
            'status' => 'published',
            'published_at' => now()->subDay(),
        ]);

        $r = $this->actingAs($this->participant, 'sanctum')->getJson('/api/announcements');
        $r->assertOk()->assertJsonStructure(['data' => ['announcements', 'pagination']]);
        $this->assertSame(1, $r->json('data.pagination.total'));
    }

    public function test_index_は_未公開お知らせを除外する(): void
    {
        Announcement::factory()->create([
            'target_roles' => ['participant'],
            'status' => 'draft',
            'published_at' => null,
        ]);

        $r = $this->actingAs($this->participant, 'sanctum')->getJson('/api/announcements');
        $r->assertOk();
        $this->assertSame(0, $r->json('data.pagination.total'));
    }

    public function test_show_は_対象ロール向けお知らせを返す(): void
    {
        $a = Announcement::factory()->create([
            'target_roles' => ['participant'],
            'status' => 'published',
            'published_at' => now()->subDay(),
        ]);

        $r = $this->actingAs($this->participant, 'sanctum')->getJson("/api/announcements/{$a->id}");
        $r->assertOk()
            ->assertJsonPath('data.announcement.id', $a->id)
            ->assertJsonPath('data.announcement.title', $a->title);
    }

    public function test_show_は_対象外ロールで403(): void
    {
        $a = Announcement::factory()->create([
            'target_roles' => ['seller'],
            'status' => 'published',
            'published_at' => now()->subDay(),
        ]);

        $this->actingAs($this->participant, 'sanctum')
            ->getJson("/api/announcements/{$a->id}")
            ->assertStatus(403);
    }

    public function test_show_は_存在しないIDで404(): void
    {
        $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/announcements/999999')
            ->assertStatus(404);
    }
}
