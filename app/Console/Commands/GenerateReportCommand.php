<?php

namespace App\Console\Commands;

use App\Services\ReportService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class GenerateReportCommand extends Command
{
    protected $signature = 'reports:generate {type=weekly : weekly or monthly}';
    protected $description = '取引レポートを自動生成';

    public function handle(ReportService $reportService): void
    {
        $type = $this->argument('type');

        $this->info("Generating {$type} report...");

        $report = match ($type) {
            'monthly' => $reportService->generateMonthlyReport(),
            default => $reportService->generateWeeklyReport(),
        };

        $filename = "reports/{$type}_{$report['period']['start']}_{$report['period']['end']}.json";
        Storage::put($filename, json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $this->info("Report saved to: {$filename}");
        $this->info("Total transactions: {$report['transaction_summary']['total_transactions']}");
        $this->info("Total sales: {$report['transaction_summary']['total_sales']}");
    }
}
