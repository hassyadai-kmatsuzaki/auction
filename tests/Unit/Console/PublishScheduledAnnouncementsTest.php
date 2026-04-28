<?php

namespace Tests\Unit\Console;

use App\Models\Announcement;
use Tests\TestCase;

class PublishScheduledAnnouncementsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
    }

    public function test_command_publishes_due_scheduled_announcements(): void
    {
        $admin = $this->createAdmin();

        $past = Announcement::factory()->create([
            'created_by' => $admin->id,
            'status' => 'scheduled',
            'published_at' => now()->subMinutes(5),
        ]);

        $this->artisan('announcements:publish-scheduled')
            ->expectsOutputToContain('公開されたお知らせ')
            ->assertExitCode(0);

        $this->assertDatabaseHas('announcements', [
            'id' => $past->id,
            'status' => 'published',
        ]);
    }

    public function test_command_does_not_publish_future_announcements(): void
    {
        $admin = $this->createAdmin();

        $future = Announcement::factory()->create([
            'created_by' => $admin->id,
            'status' => 'scheduled',
            'published_at' => now()->addHour(),
        ]);

        $this->artisan('announcements:publish-scheduled')->assertExitCode(0);

        $this->assertDatabaseHas('announcements', [
            'id' => $future->id,
            'status' => 'scheduled',
        ]);
    }

    public function test_command_does_not_touch_drafts(): void
    {
        $admin = $this->createAdmin();

        $draft = Announcement::factory()->draft()->create([
            'created_by' => $admin->id,
        ]);

        $this->artisan('announcements:publish-scheduled')->assertExitCode(0);

        $this->assertDatabaseHas('announcements', [
            'id' => $draft->id,
            'status' => 'draft',
        ]);
    }

    public function test_command_returns_zero_when_no_targets(): void
    {
        $this->artisan('announcements:publish-scheduled')
            ->expectsOutputToContain('公開されたお知らせ: 0件')
            ->assertExitCode(0);
    }

    public function test_command_skips_soft_deleted_announcements(): void
    {
        $admin = $this->createAdmin();

        $deleted = Announcement::factory()->create([
            'created_by' => $admin->id,
            'status' => 'scheduled',
            'published_at' => now()->subMinute(),
        ]);
        $deleted->delete();

        $this->artisan('announcements:publish-scheduled')->assertExitCode(0);

        // ソフトデリート済みは status を変更しない
        $this->assertSame('scheduled', $deleted->fresh()->status);
    }
}
