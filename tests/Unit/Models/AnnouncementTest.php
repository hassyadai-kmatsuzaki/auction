<?php

namespace Tests\Unit\Models;

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

    public function test_announcement_belongs_to_creator(): void
    {
        $announcement = Announcement::factory()->create(['created_by' => $this->admin->id]);

        $this->assertInstanceOf(User::class, $announcement->creator);
        $this->assertEquals($this->admin->id, $announcement->creator->id);
    }

    public function test_announcement_target_roles_cast(): void
    {
        $announcement = Announcement::factory()->create([
            'created_by' => $this->admin->id,
            'target_roles' => ['seller', 'participant'],
        ]);

        $this->assertIsArray($announcement->target_roles);
        $this->assertContains('seller', $announcement->target_roles);
        $this->assertContains('participant', $announcement->target_roles);
    }

    public function test_announcement_target_roles_contains_role(): void
    {
        $announcement = Announcement::factory()->create([
            'created_by' => $this->admin->id,
            'target_roles' => ['seller', 'participant'],
        ]);

        $this->assertContains('seller', $announcement->target_roles);
        $this->assertContains('participant', $announcement->target_roles);
        $this->assertNotContains('admin', $announcement->target_roles);
    }

    public function test_announcement_status_transitions(): void
    {
        $announcement = Announcement::factory()->draft()->create(['created_by' => $this->admin->id]);
        $this->assertEquals('draft', $announcement->status);

        $announcement->update(['status' => 'scheduled']);
        $this->assertEquals('scheduled', $announcement->status);

        $announcement->update(['status' => 'published']);
        $this->assertEquals('published', $announcement->status);

        $announcement->update(['status' => 'hidden']);
        $this->assertEquals('hidden', $announcement->status);
    }

    public function test_announcement_factory_states(): void
    {
        $draft = Announcement::factory()->draft()->create(['created_by' => $this->admin->id]);
        $this->assertEquals('draft', $draft->status);

        $published = Announcement::factory()->published()->create(['created_by' => $this->admin->id]);
        $this->assertEquals('published', $published->status);
    }

    public function test_announcement_soft_delete(): void
    {
        $announcement = Announcement::factory()->create(['created_by' => $this->admin->id]);
        $id = $announcement->id;

        $announcement->delete();

        // SoftDeletesの場合、削除後にデフォルトクエリでは取得できない
        $this->assertNull(Announcement::find($id));

        // withTrashedでは取得できる
        $deleted = Announcement::withTrashed()->find($id);
        $this->assertNotNull($deleted);
        $this->assertNotNull($deleted->deleted_at);
    }

    public function test_announcement_published_at_datetime_cast(): void
    {
        $publishedAt = now()->addDay();
        $announcement = Announcement::factory()->create([
            'created_by' => $this->admin->id,
            'published_at' => $publishedAt,
        ]);

        $this->assertInstanceOf(\Carbon\Carbon::class, $announcement->published_at);
    }

    public function test_announcement_factory_creates_valid_announcement(): void
    {
        $announcement = Announcement::factory()->create(['created_by' => $this->admin->id]);

        $this->assertNotNull($announcement->id);
        $this->assertNotNull($announcement->title);
        $this->assertNotNull($announcement->content);
        $this->assertNotNull($announcement->status);
        $this->assertIsArray($announcement->target_roles);
    }
}
