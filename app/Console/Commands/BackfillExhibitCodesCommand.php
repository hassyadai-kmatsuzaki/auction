<?php

namespace App\Console\Commands;

use App\Actions\Exhibit\IssueExhibitCodeAction;
use App\Models\Auction;
use App\Models\Item;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * 既存オークションの items に出品ID（exhibit_code）を一括発行する運用コマンド。
 *
 * 通常運用では LaneController::assignItem / autoAssign が発行するため不要。
 * 本コマンドは以下の場合に使う:
 *   1) 既に終了済みの過去オークションを遡って exhibit_code 付与したいとき
 *   2) lane_name 投入後に未発行のままになっている既存 items を埋め直したいとき
 *
 * デフォルトでは通知メール/LINE は飛ばさない (--notify を付けると飛ばす)。
 *
 * 使用例:
 *   sudo -u ec2-user php artisan exhibit-code:backfill --auction=12 --dry-run
 *   sudo -u ec2-user php artisan exhibit-code:backfill --auction=12
 *   sudo -u ec2-user php artisan exhibit-code:backfill --all
 */
class BackfillExhibitCodesCommand extends Command
{
    protected $signature = 'exhibit-code:backfill
        {--auction= : 対象オークションID（省略時は --all 必須）}
        {--all : 全 auction を対象にする}
        {--notify : 出品者に通知を投げる（デフォルトは通知抑止）}
        {--dry-run : 実際には更新せず対象件数だけ出力}';

    protected $description = '既存 items に exhibit_code を一括発行する（運用用）';

    public function handle(IssueExhibitCodeAction $issueAction): int
    {
        $auctionId = $this->option('auction');
        $all = (bool) $this->option('all');
        $notify = (bool) $this->option('notify');
        $dryRun = (bool) $this->option('dry-run');

        if (! $auctionId && ! $all) {
            $this->error('--auction= もしくは --all を指定してください。');
            return self::INVALID;
        }

        $auctionQuery = Auction::query();
        if ($auctionId) {
            $auctionQuery->where('id', $auctionId);
        }
        $auctions = $auctionQuery->orderBy('id')->get();

        if ($auctions->isEmpty()) {
            $this->warn('対象 auction がありません。');
            return self::SUCCESS;
        }

        $totalIssued = 0;
        $totalCandidates = 0;

        foreach ($auctions as $auction) {
            // lane_items にレコードがあるが exhibit_code が NULL のアイテムが対象
            $candidates = Item::where('auction_id', $auction->id)
                ->whereNull('exhibit_code')
                ->whereIn('id', function ($q) {
                    $q->select('item_id')->from('lane_items');
                })
                ->orderBy('id')
                ->get();

            if ($candidates->isEmpty()) {
                $this->line("  auction={$auction->id} ({$auction->title}): 対象なし");
                continue;
            }

            $totalCandidates += $candidates->count();

            $this->line("auction={$auction->id} ({$auction->title}): 対象 {$candidates->count()} 件");

            if ($dryRun) {
                continue;
            }

            $issuedCount = 0;
            foreach ($candidates as $item) {
                DB::transaction(function () use ($issueAction, $item, $notify, &$issuedCount) {
                    $code = $issueAction->execute($item, silent: ! $notify);
                    if ($code !== null) {
                        $issuedCount++;
                    }
                });
            }
            $totalIssued += $issuedCount;
            $this->info("  → 発行: {$issuedCount} 件");
        }

        if ($dryRun) {
            $this->warn("[dry-run] 発行はしていません。対象は合計 {$totalCandidates} 件でした。");
        } else {
            $this->info("完了: 合計 {$totalIssued} / {$totalCandidates} 件に exhibit_code を発行しました。");
            if (! $notify) {
                $this->line('(通知は抑止しました。--notify を付けると出品者にメール/LINE が飛びます)');
            }
        }

        return self::SUCCESS;
    }
}
