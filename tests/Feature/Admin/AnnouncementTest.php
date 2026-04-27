<?php

namespace Tests\Feature\Admin;

use App\Models\Announcement;
use App\Models\User;
use Tests\TestCase;

class AnnouncementTest extends TestCase
{
    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
    }

    public function test_admin_can_list_announcements(): void
    {
        Announcement::factory()->count(5)->create(['created_by' => $this->admin->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/announcements');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'announcements',
                    'pagination',
                ],
            ]);
    }

    public function test_admin_can_create_announcement(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/announcements', [
                'title' => 'テストお知らせ',
                'content' => 'テスト内容です',
                'target_roles' => ['seller', 'participant'],
                'is_important' => false,
                'status' => 'draft',
            ]);

        $response->assertStatus(201)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('announcements', [
            'title' => 'テストお知らせ',
        ]);
    }

    public function test_admin_can_view_announcement_detail(): void
    {
        $announcement = Announcement::factory()->create(['created_by' => $this->admin->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/announcements/{$announcement->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'announcement' => ['id', 'title', 'content', 'status'],
                ],
            ]);
    }

    public function test_admin_can_update_announcement(): void
    {
        $announcement = Announcement::factory()->draft()->create(['created_by' => $this->admin->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/announcements/{$announcement->id}", [
                'title' => '更新されたタイトル',
                'content' => '更新された内容',
                'target_roles' => ['seller', 'participant'],
                'status' => 'draft',
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('announcements', [
            'id' => $announcement->id,
            'title' => '更新されたタイトル',
        ]);
    }

    public function test_admin_can_delete_announcement(): void
    {
        $announcement = Announcement::factory()->create(['created_by' => $this->admin->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/announcements/{$announcement->id}");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        // 論理削除のため find では取得できない
        $this->assertNull(Announcement::find($announcement->id));
    }

    public function test_admin_can_publish_announcement(): void
    {
        $announcement = Announcement::factory()->draft()->create(['created_by' => $this->admin->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/announcements/{$announcement->id}", [
                'title' => $announcement->title,
                'content' => $announcement->content,
                'target_roles' => $announcement->target_roles ?? ['seller', 'participant'],
                'status' => 'published',
                'published_at' => now()->format('Y-m-d H:i:s'),
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('announcements', [
            'id' => $announcement->id,
            'status' => 'published',
        ]);
    }

    public function test_announcement_requires_title(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/announcements', [
                'content' => 'テスト内容',
                'target_roles' => ['seller'],
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['title']);
    }

    public function test_announcement_requires_content(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/announcements', [
                'title' => 'テストタイトル',
                'target_roles' => ['seller'],
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['content']);
    }

    public function test_non_admin_cannot_create_announcement(): void
    {
        $participant = $this->createParticipant();

        $response = $this->actingAs($participant, 'sanctum')
            ->postJson('/api/admin/announcements', [
                'title' => 'テストお知らせ',
                'content' => 'テスト内容',
            ]);

        $response->assertStatus(403);
    }

    public function test_admin_can_toggle_announcement_visibility(): void
    {
        $announcement = Announcement::factory()->published()->create(['created_by' => $this->admin->id]);

        // 非表示に切り替え
        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/announcements/{$announcement->id}/toggle-visibility");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('announcements', [
            'id' => $announcement->id,
            'status' => 'hidden',
        ]);

        // 再度公開
        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/announcements/{$announcement->id}/toggle-visibility");

        $response->assertStatus(200);

        $this->assertDatabaseHas('announcements', [
            'id' => $announcement->id,
            'status' => 'published',
        ]);
    }

    public function test_admin_can_generate_content_with_ai(): void
    {
        config(['services.openai.api_key' => 'test-key']);
        \Illuminate\Support\Facades\Http::fake([
            'api.openai.com/v1/chat/completions' => \Illuminate\Support\Facades\Http::response([
                'choices' => [
                    ['message' => ['content' => '【AI生成】重要なお知らせ本文']],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/announcements/generate-content', [
                'title' => 'メンテナンスのお知らせ',
                'target_roles' => ['participant', 'seller'],
                'is_important' => true,
            ]);

        $response->assertOk()
            ->assertJsonPath('data.content', '【AI生成】重要なお知らせ本文');
    }

    public function test_generate_content_validates_title(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/announcements/generate-content', [])
            ->assertStatus(422);
    }

    public function test_generate_content_returns_500_when_api_key_missing(): void
    {
        config(['services.openai.api_key' => '']);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/announcements/generate-content', [
                'title' => 'タイトル',
            ])
            ->assertStatus(500);
    }
}
