<?php

namespace App\Console\Commands;

use App\Services\ReportArchive;
use App\Services\ReportService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class GenerateReportCommand extends Command
{
    protected $signature = 'reports:generate
        {type=weekly : weekly or monthly}
        {--start= : 集計する期間に含まれる日付（YYYY-MM-DD）。省略時は締まった直前の週・月}';
    protected $description = '取引レポートを自動生成';

    public function handle(ReportService $reportService, ReportArchive $archive): void
    {
        $type = $this->argument('type');

        $this->info("Generating {$type} report...");

        // 定期実行（月曜 09:00 / 毎月1日 09:00）は「締まった直前の期間」を集計する。
        // 引数なしの既定（当週・当月）は管理画面のその場集計用なので、ここでは開始日を明示する
        $base = $this->option('start') ? Carbon::parse($this->option('start')) : null;
        $report = match ($type) {
            'monthly' => $reportService->generateMonthlyReport(($base ?? now()->subMonthNoOverflow())->copy()->startOfMonth()),
            default => $reportService->generateWeeklyReport(($base ?? now()->subWeek())->copy()->startOfWeek()),
        };

        $filename = $archive->save($report, $type);

        $this->info("Report saved to: {$filename}");
        $this->info("Total transactions: {$report['transaction_summary']['total_transactions']}");
        $this->info("Total sales: {$report['transaction_summary']['total_sales']}");
    }
}
