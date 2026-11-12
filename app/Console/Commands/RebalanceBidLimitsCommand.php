<?php

namespace App\Console\Commands;

use App\Models\BidLimitPrice;
use App\Models\Item;
use App\Services\BidLimitRebalancer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * 未開始（registered）の全商品で事前指値を並べ直す（上位2件だけ計算対象）。
 *
 * 用途: is_top_rank 列を入れた直後の初回（既存行は全件 1 で入るため）と、
 *       不整合が疑われるときの手動復旧。開催中（live の商品がある間）は流さない。
 * 実行: sudo -u ec2-user php artisan bid-limits:rebalance [--auction=ID] [--dry-run]
 */
class RebalanceBidLimitsCommand extends Command
{
    protected $signature = 'bid-limits:rebalance {--auction= : 対象オークションID（省略時は未開始の全商品）} {--dry-run : 更新せず件数だけ出す}';

    protected $description = '未開始商品の事前指値を並べ直し、上位2件だけを計算対象（is_top_rank=1）にする';

    public function handle(BidLimitRebalancer $rebalancer): int
    {
        $dry = (bool) $this->option('dry-run');

        // 3件以上の未発動指値がある商品だけが対象（2件以下は全件が計算対象で正しい）
        $query = BidLimitPrice::query()
            ->select('item_id')
            ->where('is_triggered', false)
            ->groupBy('item_id')
            ->havingRaw('COUNT(*) > ?', [BidLimitRebalancer::TOP_RANK_COUNT]);
        if ($this->option('auction')) {
            $query->whereIn('item_id', Item::where('auction_id', (int) $this->option('auction'))->select('id'));
        }
        $itemIds = $query->pluck('item_id')->all();

        $items = Item::whereIn('id', $itemIds)->where('status', 'registered')->get(['id', 'status']);
        $this->info(sprintf('対象商品: %d 件（指値3件以上かつ未開始）%s', $items->count(), $dry ? ' [dry-run]' : ''));

        $changedTotal = 0;
        foreach ($items as $item) {
            if ($dry) {
                $n = BidLimitPrice::where('item_id', $item->id)->where('is_triggered', false)->count();
                $this->line(sprintf('  item %d: 指値 %d 件 → ダミー候補 %d 件', $item->id, $n, max(0, $n - BidLimitRebalancer::TOP_RANK_COUNT)));
                continue;
            }
            $changed = DB::transaction(function () use ($item, $rebalancer) {
                $locked = Item::where('id', $item->id)->lockForUpdate()->first();
                if (!$locked) {
                    return 0;
                }
                return $rebalancer->rebalance($locked->id, $locked->status);
            }, 3);
            if ($changed > 0) {
                $this->line(sprintf('  item %d: %d 行を更新', $item->id, $changed));
            }
            $changedTotal += $changed;
        }

        if (!$dry) {
            $dummies = BidLimitPrice::where('is_triggered', false)->where('is_top_rank', false)->count();
            $this->info(sprintf('更新行数: %d / 現在のダミー行数（全体）: %d', $changedTotal, $dummies));
        }
        return self::SUCCESS;
    }
}
