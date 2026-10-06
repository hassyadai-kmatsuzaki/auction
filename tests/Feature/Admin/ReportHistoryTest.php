<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ReportHistoryTest extends TestCase
{
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Storage::fake();
        $this->admin = $this->createAdmin();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_scheduled_generation_is_listed_and_viewable(): void
    {
        Carbon::setTestNow('2026-10-05 09:00:00');
        $this->artisan('reports:generate weekly')->assertExitCode(0);
        $this->artisan('reports:generate monthly')->assertExitCode(0);
        Storage::put('reports/note.txt', 'x'); // 形式外のファイルは一覧に出さない

        $list = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/reports/history')
            ->assertOk()
            ->json('data.reports');

        $this->assertCount(2, $list);
        $monthly = collect($list)->firstWhere('type', 'monthly');
        $this->assertSame(['2026-09-01', '2026-09-30'], [$monthly['start'], $monthly['end']], '毎月1日は前月分');
        $weekly = collect($list)->firstWhere('type', 'weekly');
        $this->assertTrue($weekly['end'] < '2026-10-05', '月曜は前週分');

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/reports/history/' . $monthly['filename'])
            ->assertOk()
            ->assertJsonPath('data.report_type', 'monthly')
            ->assertJsonPath('data.period.start', '2026-09-01');
    }

    public function test_reports_whose_period_has_not_ended_are_hidden(): void
    {
        Carbon::setTestNow('2026-10-05 12:00:00');
        Storage::put('reports/monthly_2026-10-01_2026-10-31.json', '{}'); // 旧仕様で月初に保存された当月分
        Storage::put('reports/weekly_2026-09-28_2026-10-04.json', '{}');

        $list = $this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/reports/history')->json('data.reports');

        $this->assertSame(['weekly_2026-09-28_2026-10-04.json'], array_column($list, 'filename'));
    }

    public function test_unknown_or_malformed_filename_is_not_served(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/reports/history/weekly_2026-01-01_2026-01-07.json')
            ->assertStatus(404);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/reports/history/..%2F.env')
            ->assertStatus(404);
    }

    public function test_generate_with_start_option_targets_that_period(): void
    {
        $this->artisan('reports:generate', ['type' => 'monthly', '--start' => '2026-07-15'])
            ->expectsOutputToContain('reports/monthly_2026-07-01_2026-07-31.json')
            ->assertExitCode(0);

        Storage::assertExists('reports/monthly_2026-07-01_2026-07-31.json');
    }

    public function test_backfill_creates_past_weeks_and_months(): void
    {
        Carbon::setTestNow('2026-10-05 12:00:00');

        $this->artisan('reports:backfill', ['--weeks' => 3, '--months' => 2])
            ->expectsOutputToContain('完了: 週次 3 件 / 月次 2 件を保存しました')
            ->assertExitCode(0);

        Storage::assertExists('reports/monthly_2026-09-01_2026-09-30.json');
        Storage::assertExists('reports/monthly_2026-08-01_2026-08-31.json');
        $this->assertCount(5, Storage::files('reports'));
    }

    public function test_requires_admin(): void
    {
        $this->actingAs($this->createParticipant(), 'sanctum')
            ->getJson('/api/admin/reports/history')
            ->assertStatus(403);
    }
}
