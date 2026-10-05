<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * テスト開催の削除（2026-10-06 実地確認前の一回限り）。
 *
 *   sudo -u ec2-user php artisan testdata:delete              # 確認だけ（何も消さない）
 *   sudo -u ec2-user php artisan testdata:delete --execute    # 削除
 *   --include-b を付けると証跡になりうる開催（43,47,51,86,87）も対象
 *
 * users は削除しない。39（入金確認済みの実取引）と 90（実会員の練習戦）は対象外。
 * 件数が想定と違う / 入金確認済みが混ざる場合は何も消さずに止まる。事後確認NGなら ROLLBACK。
 */
class DeleteTestDataCommand extends Command
{
    protected $signature = 'testdata:delete {--execute : 実際に削除する} {--include-b : 証跡になりうる開催（43,47,51,86,87）も含める}';
    protected $description = 'テスト開催とその配下（生体・入札・落札など）を削除する。ユーザーは消さない';

    // A: 純粋なテスト・E2E
    private const GROUP_A = [35, 36, 38, 40, 41, 42, 49, 50, 53, 54, 70, 72, 75, 85];
    // B: 補助金の証跡と対応する可能性あり（5/6リハ・5/8デモ・5/21 E2E・9/10 500名試験・9/19通し試験）
    private const GROUP_B = [43, 47, 51, 86, 87];
    private const PROTECTED = [39, 90];

    private const ARCHIVE_TABLES = [
        'bid_events_archive',
        'bid_limit_prices_archive',
        'bid_participants_archive',
        'price_events_archive',
        'lane_items_archive',
    ];

    public function handle(): int
    {
        $includeB   = (bool) $this->option('include-b');
        $auctionIds = $includeB ? array_merge(self::GROUP_A, self::GROUP_B) : self::GROUP_A;
        $expected   = $includeB
            ? ['auctions' => 19, 'items' => 448, 'won' => 33]
            : ['auctions' => 14, 'items' => 72, 'won' => 9];

        if (array_intersect($auctionIds, self::PROTECTED)) {
            $this->error('中止: 39 / 90 が対象に含まれています');
            return self::FAILURE;
        }

        // ---------- 事前確認 ----------
        $auctions = DB::table('auctions')->whereIn('id', $auctionIds)->orderBy('id')->get(['id', 'title', 'status']);
        $this->table(['id', 'status', 'title'], $auctions->map(fn ($a) => [$a->id, $a->status, $a->title])->all());

        $itemIds   = DB::table('items')->whereIn('auction_id', $auctionIds)->pluck('id')->all();
        $wonCount  = DB::table('won_items')->whereIn('item_id', $itemIds)->count();
        $confirmed = DB::table('won_items')->whereIn('item_id', $itemIds)->where('payment_status', 'confirmed')->count();
        $actual    = ['auctions' => $auctions->count(), 'items' => count($itemIds), 'won' => $wonCount];

        $this->table(['', '実際', '想定'], [
            ['開催', $actual['auctions'], $expected['auctions']],
            ['生体', $actual['items'], $expected['items']],
            ['落札', $actual['won'], $expected['won']],
            ['入金確認済み', $confirmed, 0],
        ]);

        if ($actual !== $expected || $confirmed !== 0) {
            $this->error('中止: 件数が想定と違います。何も削除していません。');
            return self::FAILURE;
        }
        if (! $this->option('execute')) {
            $this->info('確認OK（何も削除していません）。削除するには --execute を付けて再実行してください。');
            return self::SUCCESS;
        }
        if (! $this->confirm('上の開催を削除します。よろしいですか？')) {
            $this->line('取りやめました。');
            return self::SUCCESS;
        }

        // ---------- 削除 ----------
        $started = microtime(true);
        try {
            DB::transaction(function () use ($auctionIds, $itemIds) {
                // won_items は NO ACTION なので先に（escrow_transactions / user_reviews は CASCADE）
                $this->line('  won_items: ' . DB::table('won_items')->whereIn('item_id', $itemIds)->delete());

                // FK の無いアーカイブ表
                foreach (self::ARCHIVE_TABLES as $table) {
                    if (Schema::hasTable($table)) {
                        $this->line("  {$table}: " . DB::table($table)->whereIn('item_id', $itemIds)->delete());
                    }
                }
                if (Schema::hasTable('auction_archive_logs')) {
                    $this->line('  auction_archive_logs: ' . DB::table('auction_archive_logs')->whereIn('auction_id', $auctionIds)->delete());
                }

                // 本体（items / lanes / deposits / seller_settlements 等は CASCADE、activity_events / ai_* は SET NULL）
                $this->line('  auctions: ' . DB::table('auctions')->whereIn('id', $auctionIds)->delete());

                // ---------- 事後確認（外れたら例外 → ROLLBACK） ----------
                $left = DB::table('auctions')->whereIn('id', $auctionIds)->count()
                    + DB::table('items')->whereIn('id', $itemIds)->count()
                    + DB::table('won_items')->whereIn('item_id', $itemIds)->count();
                $kept = DB::table('auctions')->whereIn('id', self::PROTECTED)->count();
                if ($left !== 0 || $kept !== count(self::PROTECTED)) {
                    throw new \RuntimeException("事後確認NG（残り {$left} 件 / 39・90 残存 {$kept} 件）");
                }
            });
        } catch (\Throwable $e) {
            $this->error('取り消しました（ROLLBACK）: ' . $e->getMessage());
            return self::FAILURE;
        }

        $this->info(sprintf('削除完了（COMMIT 済み・%.1f 秒）', microtime(true) - $started));
        $this->call('cache:clear');

        return self::SUCCESS;
    }
}
