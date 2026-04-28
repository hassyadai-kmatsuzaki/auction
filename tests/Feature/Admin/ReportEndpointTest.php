<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use App\Services\ReportService;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * Admin/ReportController エンドポイントの追加カバレッジ。
 *
 * 既存の ReportTest と重複しないよう、ここでは認可・引数バリデーション・
 * レスポンス契約を中心にカバーする。
 */
class ReportEndpointTest extends TestCase
{
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
    }

    public function test_weekly_endpoint_uses_query_start_date(): void
    {
        $start = now()->subDays(20)->startOfWeek();

        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/reports/weekly?start_date=' . $start->toDateString());

        $r->assertOk();
        $this->assertSame($start->toDateString(), $r->json('data.period.start'));
    }

    public function test_monthly_endpoint_returns_full_structure(): void
    {
        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/reports/monthly');

        $r->assertOk()
            ->assertJsonStructure([
                'success',
                'data' => [
                    'report_type',
                    'period' => ['start', 'end'],
                    'auction_summary',
                    'transaction_summary',
                    'species_ranking',
                    'user_stats',
                    'payment_rate',
                ],
            ])
            ->assertJsonPath('data.report_type', 'monthly');
    }

    public function test_generate_dispatches_monthly_command(): void
    {
        Artisan::shouldReceive('call')
            ->once()
            ->with('reports:generate', ['type' => 'monthly'])
            ->andReturn(0);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/reports/generate', ['type' => 'monthly'])
            ->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_generate_requires_type(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/reports/generate', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['type']);
    }

    public function test_seller_cannot_get_weekly_report(): void
    {
        $seller = $this->createSeller();
        $this->actingAs($seller, 'sanctum')
            ->getJson('/api/admin/reports/weekly')
            ->assertStatus(403);
    }

    public function test_unauthenticated_cannot_post_generate(): void
    {
        $this->postJson('/api/admin/reports/generate', ['type' => 'weekly'])
            ->assertStatus(401);
    }

    public function test_report_service_is_resolved_from_container(): void
    {
        $this->assertInstanceOf(ReportService::class, app(ReportService::class));
    }
}
