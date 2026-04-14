<?php

namespace App\Console\Commands;

use App\Actions\Auction\ArchiveAuctionAction;
use App\Actions\Auction\UnarchiveAuctionAction;
use App\Models\Auction;
use Illuminate\Console\Command;

class ArchiveAuctionCommand extends Command
{
    protected $signature = 'auction:archive
                            {auction_id? : 対象オークションID（省略時は --days 経過後の finished を一括）}
                            {--days=7 : 終了から何日経過したものを対象にするか（一括時）}
                            {--dry-run : 件数のみ表示して実行しない}
                            {--force : status=finished でなくても、または再アーカイブでも強制実行}
                            {--unarchive : アーカイブから本番テーブルへ復元する}
                            {--note= : 監査ログに残すメモ}';

    protected $description = '終了したオークションの入札ログを _archive テーブル群へ退避／復元する。';

    public function handle(
        ArchiveAuctionAction $archiveAction,
        UnarchiveAuctionAction $unarchiveAction,
    ): int {
        $auctionId = $this->argument('auction_id');
        $isUnarchive = (bool) $this->option('unarchive');

        if ($isUnarchive) {
            if (!$auctionId) {
                $this->error('--unarchive はオークションIDが必須です。');
                return self::FAILURE;
            }
            return $this->runUnarchive($unarchiveAction, (int) $auctionId);
        }

        if ($auctionId) {
            return $this->runArchiveForOne($archiveAction, (int) $auctionId);
        }

        return $this->runArchiveForFinished($archiveAction);
    }

    private function runArchiveForOne(ArchiveAuctionAction $action, int $auctionId): int
    {
        $auction = Auction::find($auctionId);
        if (!$auction) {
            $this->error("オークション #{$auctionId} が見つかりません。");
            return self::FAILURE;
        }

        $result = $action->execute($auction, [
            'force' => (bool) $this->option('force'),
            'dry_run' => (bool) $this->option('dry-run'),
            'note' => $this->option('note'),
        ]);

        return $this->renderResult($auctionId, $result);
    }

    private function runArchiveForFinished(ArchiveAuctionAction $action): int
    {
        $days = (int) $this->option('days');
        $threshold = now()->subDays($days);

        // updated_at（status=finishedに更新されたタイミング）でざっくり絞る
        $targets = Auction::where('status', 'finished')
            ->where('updated_at', '<=', $threshold)
            ->whereNotIn('id', function ($q) {
                $q->select('auction_id')
                  ->from('auction_archive_logs')
                  ->where('operation', 'archive');
            })
            ->orderBy('id')
            ->get();

        if ($targets->isEmpty()) {
            $this->info("対象オークションはありません（{$days}日以上経過した未アーカイブの finished なし）。");
            return self::SUCCESS;
        }

        $this->info("対象: {$targets->count()} 件");
        $hasFailure = false;
        foreach ($targets as $auction) {
            $this->line("--- #{$auction->id} {$auction->title} ---");
            try {
                $result = $action->execute($auction, [
                    'force' => false,
                    'dry_run' => (bool) $this->option('dry-run'),
                    'note' => $this->option('note'),
                ]);
                if (!$result['success']) {
                    $hasFailure = true;
                }
                $this->renderResult($auction->id, $result);
            } catch (\Throwable $e) {
                $hasFailure = true;
                $this->error("  失敗: {$e->getMessage()}");
            }
        }

        return $hasFailure ? self::FAILURE : self::SUCCESS;
    }

    private function runUnarchive(UnarchiveAuctionAction $action, int $auctionId): int
    {
        $result = $action->execute($auctionId, [
            'note' => $this->option('note'),
        ]);

        $this->line($result['success'] ? "<info>{$result['message']}</info>" : "<error>{$result['message']}</error>");
        $this->renderCounts($result['counts']);
        return $result['success'] ? self::SUCCESS : self::FAILURE;
    }

    private function renderResult(int $auctionId, array $result): int
    {
        if ($result['success']) {
            $this->info("  {$result['message']}");
        } else {
            $this->warn("  {$result['message']}");
        }
        $this->renderCounts($result['counts']);
        return $result['success'] ? self::SUCCESS : self::FAILURE;
    }

    private function renderCounts(array $counts): void
    {
        if (empty($counts)) {
            return;
        }
        $rows = [];
        foreach ($counts as $table => $count) {
            $rows[] = [$table, number_format($count)];
        }
        $this->table(['Table', 'Rows'], $rows);
    }
}
