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
        config(['features.announcement_read' => true]);
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

    private function publishFor(string $role, int $daysAgo = 1): Announcement
    {
        return Announcement::factory()->create([
            'target_roles' => [$role],
            'status' => 'published',
            'published_at' => now()->subDays($daysAgo),
        ]);
    }

    public function test_未読数は7日以内かつ未読のものだけ数える(): void
    {
        $this->publishFor('participant', 1);
        $this->publishFor('participant', 2);
        $this->publishFor('participant', 10); // 7日より前
        $this->publishFor('seller', 1);       // 対象外ロール

        $r = $this->actingAs($this->participant, 'sanctum')->getJson('/api/announcements');
        $r->assertOk()->assertJsonPath('data.unread_count', 2);
        $this->assertFalse($r->json('data.announcements.0.is_read'));
    }

    public function test_既読にすると未読数が減り_他人には影響しない(): void
    {
        $a = $this->publishFor('participant');
        $b = $this->publishFor('participant');
        $other = $this->createParticipant();

        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/announcements/read', ['ids' => [$a->id]])
            ->assertOk()
            ->assertJsonPath('data.unread_count', 1);

        $list = $this->actingAs($this->participant, 'sanctum')->getJson('/api/announcements')->json('data.announcements');
        $this->assertTrue(collect($list)->firstWhere('id', $a->id)['is_read']);
        $this->assertFalse(collect($list)->firstWhere('id', $b->id)['is_read']);

        $this->actingAs($other, 'sanctum')->getJson('/api/announcements')->assertJsonPath('data.unread_count', 2);
    }

    public function test_既読化は二重送信しても1件のまま(): void
    {
        $a = $this->publishFor('participant');

        $this->actingAs($this->participant, 'sanctum')->postJson('/api/announcements/read', ['ids' => [$a->id]])->assertOk();
        $this->actingAs($this->participant, 'sanctum')->postJson('/api/announcements/read', ['ids' => [$a->id]])->assertOk();

        $this->assertSame(1, \DB::table('announcement_reads')->where('user_id', $this->participant->id)->count());
    }

    public function test_見えないお知らせは既読化できない(): void
    {
        $sellerOnly = $this->publishFor('seller');

        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/announcements/read', ['ids' => [$sellerOnly->id]])
            ->assertOk();

        $this->assertSame(0, \DB::table('announcement_reads')->count());
    }

    public function test_詳細を開くと既読になる(): void
    {
        $a = $this->publishFor('participant');

        $this->actingAs($this->participant, 'sanctum')->getJson("/api/announcements/{$a->id}")->assertOk();

        $this->actingAs($this->participant, 'sanctum')->getJson('/api/announcements')->assertJsonPath('data.unread_count', 0);
    }

    public function test_既読化は未認証で401(): void
    {
        $this->postJson('/api/announcements/read', ['ids' => [1]])->assertStatus(401);
    }

    public function test_既読管理OFFのときは既読化しない(): void
    {
        config(['features.announcement_read' => false]);
        $a = $this->publishFor('participant');

        $this->actingAs($this->participant, 'sanctum')->postJson('/api/announcements/read', ['ids' => [$a->id]])->assertStatus(404);
        $this->actingAs($this->participant, 'sanctum')->getJson("/api/announcements/{$a->id}")->assertOk();

        $this->assertSame(0, \DB::table('announcement_reads')->count());
    }
}
