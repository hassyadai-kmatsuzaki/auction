<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use App\Services\ReportService;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * 管理者向けレポート（週次／月次）の Feature + Unit テスト。
 *
 * - ReportService: generateWeeklyReport / generateMonthlyReport の構造と集計
 * - ReportController: weekly / monthly / generate
 */
class ReportTest extends TestCase
{
    private User $admin;
    private SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
    }

    private function makeWonItemWithin(int $daysAgo = 1, array $override = []): WonItem
    {
        $when = now()->startOfDay()->addHours(12); // 同日の正午基準
        if ($daysAgo > 0) {
            $when = $when->subDays($daysAgo);
        }
        $species = $override['species_name'] ?? 'メダカ';
        unset($override['species_name']);

        $auction = Auction::factory()->finished()->create([
            'created_by' => $this->admin->id,
            'event_date' => $when,
        ]);
        $item = Item::factory()->sold()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'species_name' => $species,
        ]);
        return WonItem::factory()->create(array_merge([
            'item_id' => $item->id,
            'winner_id' => $this->createParticipant()->id,
            'winning_price' => 5000,
            'payment_status' => 'pending',
            'created_at' => $when,
        ], $override));
    }

    public function test_generateWeeklyReport_は_期間内の集計を返す(): void
    {
        $start = now()->startOfWeek();
        $this->makeWonItemWithin(0, ['winning_price' => 10000, 'payment_status' => 'paid', 'created_at' => $start->copy()->addHour()]);
        $this->makeWonItemWithin(0, ['winning_price' => 6000, 'created_at' => $start->copy()->addHours(2)]);

        $report = app(ReportService::class)->generateWeeklyReport($start);
        $this->assertSame('weekly', $report['report_type']);
        $this->assertArrayHasKey('period', $report);
        $this->assertArrayHasKey('auction_summary', $report);
        $this->assertArrayHasKey('transaction_summary', $report);
        $this->assertArrayHasKey('species_ranking', $report);
        $this->assertArrayHasKey('user_stats', $report);
        $this->assertSame(2, $report['transaction_summary']['total_transactions']);
        $this->assertSame(16000, $report['transaction_summary']['total_sales']);
        $this->assertSame(50.0, (float) $report['payment_rate']);
    }

    public function test_generateWeeklyReport_は_期間指定で動作する(): void
    {
        $this->makeWonItemWithin(40, ['winning_price' => 9000]); // 範囲外

        $report = app(ReportService::class)->generateWeeklyReport(now()->subDays(7));
        $this->assertSame(0, $report['transaction_summary']['total_transactions']);
    }

    public function test_generateMonthlyReport_は_今月集計を返す(): void
    {
        $this->makeWonItemWithin(1, ['winning_price' => 12000]);

        $report = app(ReportService::class)->generateMonthlyReport();
        $this->assertSame('monthly', $report['report_type']);
        $this->assertGreaterThan(0, $report['transaction_summary']['total_sales']);
    }

    public function test_generateReport_は_品種別ランキングを返す(): void
    {
        $start = now()->startOfWeek();
        $this->makeWonItemWithin(0, ['species_name' => 'メダカ', 'winning_price' => 5000, 'created_at' => $start->copy()->addHour()]);
        $this->makeWonItemWithin(0, ['species_name' => 'メダカ', 'winning_price' => 7000, 'created_at' => $start->copy()->addHours(2)]);
        $this->makeWonItemWithin(0, ['species_name' => '楊貴妃', 'winning_price' => 9000, 'created_at' => $start->copy()->addHours(3)]);

        $report = app(ReportService::class)->generateWeeklyReport($start);
        $top = $report['species_ranking']->first();
        $this->assertSame('メダカ', $top->species_name);
        $this->assertSame(2, (int) $top->count);
    }

    public function test_admin_can_get_weekly_report(): void
    {
        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/reports/weekly');
        $r->assertOk()
            ->assertJsonStructure(['data' => ['report_type', 'period', 'auction_summary', 'transaction_summary', 'payment_rate']]);
    }

    public function test_admin_can_get_weekly_report_with_start_date(): void
    {
        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/reports/weekly?start_date=' . now()->subDays(14)->toDateString());
        $r->assertOk();
    }

    public function test_admin_can_get_monthly_report(): void
    {
        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/reports/monthly');
        $r->assertOk()
            ->assertJsonPath('data.report_type', 'monthly');
    }

    public function test_admin_generate_weekly_dispatches_command(): void
    {
        Artisan::shouldReceive('call')
            ->once()
            ->with('reports:generate', ['type' => 'weekly'])
            ->andReturn(0);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/reports/generate', ['type' => 'weekly']);
        $r->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_admin_generate_validates_type(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/reports/generate', ['type' => 'invalid'])
            ->assertStatus(422);
    }

    public function test_non_admin_cannot_access_reports(): void
    {
        $participant = $this->createParticipant();
        $this->actingAs($participant, 'sanctum')
            ->getJson('/api/admin/reports/weekly')
            ->assertStatus(403);
    }
}
