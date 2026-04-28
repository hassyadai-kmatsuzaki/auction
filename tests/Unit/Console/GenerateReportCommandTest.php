<?php

namespace Tests\Unit\Console;

use App\Services\ReportService;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class GenerateReportCommandTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Storage::fake();
    }

    private function bindStubReportService(string $type): array
    {
        $report = [
            'period' => ['start' => '2026-04-01', 'end' => '2026-04-07'],
            'transaction_summary' => [
                'total_transactions' => 5,
                'total_sales' => 123456,
            ],
        ];

        $this->app->bind(ReportService::class, function () use ($report, $type) {
            return new class($report, $type) extends ReportService {
                public function __construct(private array $report, private string $expectedType) {}
                public function generateWeeklyReport(?\Illuminate\Support\Carbon $startDate = null): array
                {
                    return $this->report;
                }
                public function generateMonthlyReport(?\Illuminate\Support\Carbon $startDate = null): array
                {
                    return $this->report;
                }
            };
        });

        return $report;
    }

    public function test_command_generates_weekly_report_by_default(): void
    {
        $report = $this->bindStubReportService('weekly');

        $this->artisan('reports:generate')
            ->expectsOutputToContain('Generating weekly report')
            ->expectsOutputToContain('Total transactions: 5')
            ->assertExitCode(0);

        Storage::assertExists("reports/weekly_{$report['period']['start']}_{$report['period']['end']}.json");
    }

    public function test_command_generates_monthly_report(): void
    {
        $report = $this->bindStubReportService('monthly');

        $this->artisan('reports:generate', ['type' => 'monthly'])
            ->expectsOutputToContain('Generating monthly report')
            ->assertExitCode(0);

        Storage::assertExists("reports/monthly_{$report['period']['start']}_{$report['period']['end']}.json");
    }

    public function test_command_falls_back_to_weekly_for_unknown_type(): void
    {
        // 不正引数の場合、match のデフォルトで weekly が呼ばれる
        $this->bindStubReportService('weekly');

        $this->artisan('reports:generate', ['type' => 'invalid'])
            ->expectsOutputToContain('Generating invalid report')
            ->assertExitCode(0);
    }

    public function test_command_outputs_total_sales(): void
    {
        $this->bindStubReportService('weekly');

        $this->artisan('reports:generate')
            ->expectsOutputToContain('Total sales: 123456')
            ->assertExitCode(0);
    }
}
