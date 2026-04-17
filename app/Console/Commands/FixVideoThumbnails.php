<?php

namespace App\Console\Commands;

use App\Models\Item;
use App\Models\ItemMedia;
use App\Services\StorageService;
use Illuminate\Console\Command;

class FixVideoThumbnails extends Command
{
    protected $signature = 'items:fix-video-thumbnails {--dry-run : 実際には更新せず件数だけ出力}';
    protected $description = '動画が is_thumbnail=true になっている商品を検出し、写真に差し替える（無ければ thumbnail_path を null に）';

    public function handle(StorageService $storage): int
    {
        $dryRun = (bool) $this->option('dry-run');

        // 動画なのに is_thumbnail=true になっているメディア
        $badMedia = ItemMedia::query()
            ->where('is_thumbnail', true)
            ->where(function ($q) {
                $q->where('media_type', 'like', 'video%')
                  ->orWhere('mime_type', 'like', 'video/%');
            })
            ->get();

        $this->info('動画サムネイルのメディア: ' . $badMedia->count() . ' 件');

        $fixedItems = 0;

        foreach ($badMedia->groupBy('item_id') as $itemId => $videos) {
            $item = Item::find($itemId);
            if (! $item) continue;

            // すべてのメディアから最初の写真を探す
            $photo = ItemMedia::query()
                ->where('item_id', $itemId)
                ->where('media_type', 'like', 'photo%')
                ->orderBy('display_order')
                ->first();

            if ($dryRun) {
                $this->line(sprintf(
                    '- Item #%d: 動画サムネ解除 %d 件, 写真サムネ設定 %s',
                    $item->id,
                    $videos->count(),
                    $photo ? "(media #{$photo->id})" : '(写真なし → thumbnail_path NULL)'
                ));
                $fixedItems++;
                continue;
            }

            // 動画メディアの is_thumbnail を解除
            ItemMedia::where('item_id', $itemId)->update(['is_thumbnail' => false]);

            if ($photo) {
                $photo->is_thumbnail = true;
                $photo->save();
                $item->thumbnail_path = $storage->url($photo->file_path);
            } else {
                $item->thumbnail_path = null;
            }
            $item->save();
            $fixedItems++;
        }

        // is_thumbnail が true の写真が無いのに item.thumbnail_path が動画URLを指しているケースも救済
        $suspectItems = Item::query()
            ->whereNotNull('thumbnail_path')
            ->where(function ($q) {
                $q->where('thumbnail_path', 'like', '%.mp4%')
                  ->orWhere('thumbnail_path', 'like', '%.mov%')
                  ->orWhere('thumbnail_path', 'like', '%.webm%');
            })
            ->get();

        $this->info('thumbnail_path が動画URLの商品: ' . $suspectItems->count() . ' 件');

        foreach ($suspectItems as $item) {
            $photo = ItemMedia::query()
                ->where('item_id', $item->id)
                ->where('media_type', 'like', 'photo%')
                ->orderBy('display_order')
                ->first();

            if ($dryRun) {
                $this->line(sprintf(
                    '- Item #%d: thumbnail_path 動画 → %s',
                    $item->id,
                    $photo ? "写真 (media #{$photo->id})" : 'NULL'
                ));
                continue;
            }

            ItemMedia::where('item_id', $item->id)->update(['is_thumbnail' => false]);
            if ($photo) {
                $photo->is_thumbnail = true;
                $photo->save();
                $item->thumbnail_path = $storage->url($photo->file_path);
            } else {
                $item->thumbnail_path = null;
            }
            $item->save();
            $fixedItems++;
        }

        $this->info(($dryRun ? '[dry-run] ' : '') . "修正対象商品: {$fixedItems} 件");
        return self::SUCCESS;
    }
}
