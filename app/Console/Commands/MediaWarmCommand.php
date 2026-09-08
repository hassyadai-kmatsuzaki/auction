<?php

namespace App\Console\Commands;

use App\Models\Auction;
use App\Models\ItemMedia;
use App\Services\MediaOptimizer;
use Illuminate\Console\Command;

/**
 * B-9 (2026-09-08): 開催前に商品画像の最適化 variant を事前生成する。
 *
 * 当日、商品が切り替わるたびに 500 人が同じ画像を同時に要求し、キャッシュミスなら
 * php-fpm が GD 変換を並走させる（8/28 は 95 人で CPU 96.9%）。前日にここで全部作っておけば
 * 当日は「キャッシュを返すだけ」になる。B-8 の排他と合わせて使う。
 *
 *   sudo -u ec2-user php artisan media:warm --auction=123
 *   sudo -u ec2-user php artisan media:warm --auction=123 --with-media --presets=thumb,small,medium,large
 */
class MediaWarmCommand extends Command
{
    protected $signature = 'media:warm
        {--auction= : 対象オークションID（必須）}
        {--presets=thumb,small,medium : 生成するプリセット（カンマ区切り）}
        {--status=registered,live : 対象商品の status（カンマ区切り）}
        {--with-media : サムネイルだけでなく商品の追加画像（ItemMedia）も対象にする}';

    protected $description = '開催前に商品画像の最適化 variant を事前生成する（当日のキャッシュミス変換を無くす）';

    public function handle(MediaOptimizer $optimizer): int
    {
        $auctionId = (int) $this->option('auction');
        if ($auctionId <= 0) {
            $this->error('--auction=<ID> を指定してください。');
            return self::FAILURE;
        }

        $auction = Auction::find($auctionId);
        if (!$auction) {
            $this->error("オークション {$auctionId} が見つかりません。");
            return self::FAILURE;
        }

        $presets  = array_values(array_filter(array_map('trim', explode(',', (string) $this->option('presets')))));
        $unknown  = array_diff($presets, array_keys(MediaOptimizer::SIZE_PRESETS));
        if ($unknown) {
            $this->error('不明なプリセット: ' . implode(', ', $unknown) . '（使えるのは ' . implode(', ', array_keys(MediaOptimizer::SIZE_PRESETS)) . '）');
            return self::FAILURE;
        }
        $statuses = array_values(array_filter(array_map('trim', explode(',', (string) $this->option('status')))));

        $items = $auction->items()->whereIn('status', $statuses)->orderBy('item_number')->get(['id', 'item_number', 'thumbnail_path']);

        // 対象パスを集める（重複は除く）
        $paths = [];
        foreach ($items as $item) {
            if ($item->thumbnail_path) {
                $sp = $optimizer->extractStoragePath($item->thumbnail_path);
                if ($sp) {
                    $paths[$sp] = true;
                }
            }
        }
        if ($this->option('with-media') && $items->isNotEmpty()) {
            ItemMedia::whereIn('item_id', $items->pluck('id'))
                ->where('mime_type', 'like', 'image/%')
                ->pluck('file_path')
                ->each(function ($fp) use (&$paths, $optimizer) {
                    $sp = $fp ? $optimizer->extractStoragePath($fp) : null;
                    if ($sp) {
                        $paths[$sp] = true;
                    }
                });
        }

        $paths = array_keys($paths);
        $this->info(sprintf('オークション %d「%s」: 商品 %d 件 / 画像 %d 枚 / プリセット %s',
            $auction->id, $auction->title, $items->count(), count($paths), implode(',', $presets)));

        if (empty($paths)) {
            $this->warn('対象画像がありません。');
            return self::SUCCESS;
        }

        $started = microtime(true);
        $totals  = ['cached' => 0, 'generated' => 0, 'original' => 0, 'missing' => 0];
        $failed  = [];

        $bar = $this->output->createProgressBar(count($paths));
        $bar->start();
        foreach ($paths as $sp) {
            $result = $optimizer->warm($sp, $presets);
            foreach ($result as $preset => $source) {
                $totals[$source] = ($totals[$source] ?? 0) + 1;
                if ($source === 'original' || $source === 'missing') {
                    $failed[] = "{$sp} [{$preset}] => {$source}";
                }
            }
            $bar->advance();
        }
        $bar->finish();
        $this->newLine(2);

        $this->table(
            ['既にあった', '今回生成', '変換失敗（元画像のまま）', '元画像なし', '所要秒'],
            [[$totals['cached'], $totals['generated'], $totals['original'], $totals['missing'], round(microtime(true) - $started, 1)]]
        );

        if ($failed) {
            $this->warn('要確認（当日はこの画像だけ元画像配信になります）:');
            foreach ($failed as $line) {
                $this->line('  ' . $line);
            }
        }

        return self::SUCCESS;
    }
}
