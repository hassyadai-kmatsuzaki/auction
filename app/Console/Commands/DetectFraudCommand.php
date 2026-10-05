<?php

namespace App\Console\Commands;

use App\Models\Auction;
use App\Services\AI\AiDataScope;
use App\Services\AI\FraudDetectionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class DetectFraudCommand extends Command
{
    protected $signature = 'ai:detect-fraud
        {--auction= : 対象オークションID（省略時は直近に終了した開催）}
        {--days=7 : 省略時に対象とする「終了済みの開催日」の範囲（日数）}';

    protected $description = '終了済みオークションの不正入札検知を自動実行（F-056）。検知ロジックは管理画面の手動実行と同じ';

    public function handle(FraudDetectionService $service): int
    {
        $auctionIds = $this->option('auction')
            ? [(int) $this->option('auction')]
            : $this->recentFinishedAuctionIds((int) $this->option('days'));

        $total = 0;
        foreach ($auctionIds as $auctionId) {
            // 1開催の失敗で残りを止めない（アラートは firstOrCreate なので再実行しても重複しない）
            try {
                $count = count($service->analyzeAuction($auctionId));
                $total += $count;
                $this->line("auction {$auctionId}: 新規アラート {$count} 件");
            } catch (\Throwable $e) {
                Log::error('ai:detect-fraud failed', ['auction_id' => $auctionId, 'error' => $e->getMessage()]);
                $this->error("auction {$auctionId}: 失敗 {$e->getMessage()}");
            }
        }

        $this->info(sprintf('完了: %d 開催 / 新規アラート %d 件', count($auctionIds), $total));

        return self::SUCCESS;
    }

    /**
     * 直近 N 日に開催・終了した本番オークション（テスト開催と AI 集計の除外対象は含めない）
     */
    private function recentFinishedAuctionIds(int $days): array
    {
        return Auction::where('status', 'finished')
            ->whereDate('event_date', '>=', now()->subDays(max(1, $days))->toDateString())
            ->where(fn ($q) => $q->where('is_test', false)->orWhereNull('is_test'))
            ->whereNotIn('id', AiDataScope::excludedAuctionIds() ?: [0])
            ->orderBy('id')
            ->pluck('id')
            ->all();
    }
}
