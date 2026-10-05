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
 *
 * 対象: 51,73,86,87,88（73/88 はキャンセル済み開催）。users は削除しない。残す開催: 39（入金確認済みの実取引）/ 43・47（5/6リハ・5/8デモ）/ 90（実会員の練習戦）。
 * 件数が想定と違う / 入金確認済みが混ざる場合は何も消さずに止まる。事後確認NGなら ROLLBACK。
 */
class DeleteTestDataCommand extends Command
{
    protected $signature = 'testdata:delete {--execute : 実際に削除する}';
    protected $description = 'テスト開催とその配下（生体・入札・落札など）を削除する。ユーザーは消さない';

    // 2回目（1回目の 35,36,38,40,41,42,49,50,53,54,70,72,75,85 は 2026-10-05 削除済み）
    // 想定: [生体数, 落札数]。null は件数を問わない（キャンセル済み開催。status=cancelled かつ落札0が条件）
    private const TARGET = [
        51 => [200, 0],   // 5/21 E2E
        73 => null,       // キャンセル済み
        86 => [80, 16],   // 9/10 500名試験
        87 => [30, 8],    // 9/19 通し試験
        88 => null,       // キャンセル済み
    ];
    private const PROTECTED = [39, 43, 47, 90];

    private const ARCHIVE_TABLES = [
        'bid_events_archive',
        'bid_limit_prices_archive',
        'bid_participants_archive',
        'price_events_archive',
        'lane_items_archive',
    ];

    public function handle(): int
    {
        $auctionIds = array_keys(self::TARGET);

        if (array_intersect($auctionIds, self::PROTECTED)) {
            $this->error('中止: 残す開催（39 / 43 / 47 / 90）が対象に含まれています');
            return self::FAILURE;
        }

        // ---------- 事前確認（開催ごと） ----------
        $auctions = DB::table('auctions')->whereIn('id', $auctionIds)->get(['id', 'title', 'status'])->keyBy('id');
        $rows = [];
        $ok   = true;
        foreach (self::TARGET as $id => $expect) {
            $a         = $auctions->get($id);
            $items     = DB::table('items')->where('auction_id', $id)->count();
            $wonQuery  = DB::table('won_items')->join('items', 'items.id', '=', 'won_items.item_id')->where('items.auction_id', $id);
            $won       = (clone $wonQuery)->count();
            $confirmed = (clone $wonQuery)->where('won_items.payment_status', 'confirmed')->count();

            if ($a === null) {
                $result = 'NG: 開催が存在しない';
            } elseif ($confirmed !== 0) {
                $result = 'NG: 入金確認済みあり';
            } elseif ($expect === null) {
                $result = ($a->status === 'cancelled' && $won === 0) ? 'OK' : 'NG: キャンセル済み・落札0 ではない';
            } else {
                $result = ($items === $expect[0] && $won === $expect[1]) ? 'OK' : "NG: 想定 生体{$expect[0]}/落札{$expect[1]}";
            }
            $ok = $ok && $result === 'OK';
            $rows[] = [$id, $a->status ?? '-', $a->title ?? '-', $items, $won, $confirmed, $result];
        }
        $this->table(['id', 'status', 'title', '生体', '落札', '入金確認済み', '判定'], $rows);

        if (! $ok) {
            $this->error('中止: 想定と違う開催があります。何も削除していません。');
            return self::FAILURE;
        }

        $itemIds = DB::table('items')->whereIn('auction_id', $auctionIds)->pluck('id')->all();
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
                    throw new \RuntimeException("事後確認NG（残り {$left} 件 / 残す開催の残存 {$kept} 件）");
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
