<?php

namespace App\Jobs;

use App\Actions\Item\ApplyThumbnailByViewAction;
use App\Models\Item;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * 撮影ビュー（生体名→上見/横見）を登録・更新したときの遡及再適用。
 *
 * 対象 = その生体名（前後trim一致）の既存 item のうち
 *   - auction が開催前（preparing / scheduled）
 *   - 手動サムネ指定でない（thumbnail_is_manual=false）
 * のものだけ。開催中・終了の出品や手動指定個体は書き換えない。
 */
class ReapplyThumbnailViewJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        private readonly string $speciesName,
    ) {}

    public function handle(ApplyThumbnailByViewAction $apply): void
    {
        $name = trim($this->speciesName);
        if ($name === '') {
            return;
        }

        $items = Item::query()
            ->whereRaw('TRIM(species_name) = ?', [$name])
            ->where('thumbnail_is_manual', false)
            ->whereHas('auction', function ($q) {
                $q->whereIn('status', ['preparing', 'scheduled']);
            })
            ->get();

        $changed = 0;
        foreach ($items as $item) {
            $result = $apply->execute($item);
            if ($result['changed']) {
                $changed++;
            }
        }

        Log::info('ReapplyThumbnailViewJob done', [
            'species_name' => $name,
            'scanned'      => $items->count(),
            'changed'      => $changed,
        ]);
    }
}
