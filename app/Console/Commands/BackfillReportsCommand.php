<?php

namespace App\Console\Commands;

use App\Services\ReportArchive;
use App\Services\ReportService;
use Illuminate\Console\Command;

/**
 * 過去の週次・月次レポートをまとめて作り直す（F-060）。
 * 2026-10-05 以前の自動生成は「始まったばかりの週・月」を集計していたため、締まった期間で上書きする。
 */
class BackfillReportsCommand extends Command
{
    protected $signature = 'reports:backfill
        {--weeks=12 : 何週前まで作るか}
        {--months=6 : 何か月前まで作るか}';
    protected $description = '過去の週次・月次レポートを締まった期間でまとめて作り直す';

    public function handle(ReportService $reportService, ReportArchive $archive): int
    {
        $weeks = max(0, (int) $this->option('weeks'));
        $months = max(0, (int) $this->option('months'));

        for ($i = 1; $i <= $weeks; $i++) {
            $report = $reportService->generateWeeklyReport(now()->subWeeks($i)->startOfWeek());
            $this->line(sprintf('週次 %s〜%s 取引 %d 件', $report['period']['start'], $report['period']['end'], $report['transaction_summary']['total_transactions']));
            $archive->save($report, 'weekly');
        }

        for ($i = 1; $i <= $months; $i++) {
            $report = $reportService->generateMonthlyReport(now()->subMonthsNoOverflow($i)->startOfMonth());
            $this->line(sprintf('月次 %s〜%s 取引 %d 件', $report['period']['start'], $report['period']['end'], $report['transaction_summary']['total_transactions']));
            $archive->save($report, 'monthly');
        }

        $this->info("完了: 週次 {$weeks} 件 / 月次 {$months} 件を保存しました");

        return self::SUCCESS;
    }
}
