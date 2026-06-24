<?php

namespace App\Actions\Item;

use App\Models\Item;
use App\Models\ItemMedia;
use App\Models\SpeciesThumbnailView;
use App\Services\StorageService;

/**
 * 生体名の撮影ビュー（上見/横見）に従って、item のサムネを決定的に設定する。
 *
 * - 品種ビュー登録済み: その向き（top→photo_top / side→photo_side）の写真をサムネにする。
 * - 未登録の生体名: 上見(top)デフォルト。
 * - 一致する向きの写真が無い場合: 既存サムネがあれば据え置き。無ければ暫定で先頭の写真。
 * - 手動指定（items.thumbnail_is_manual=true）の個体は $force=false の限りスキップ。
 *
 * アップロード時の自動サムネ・遡及バッチの両方から呼ばれる共通処理。冪等。
 */
class ApplyThumbnailByViewAction
{
    public function __construct(
        private readonly StorageService $storage,
    ) {}

    /**
     * @return array{changed: bool, reason: string, view: string, media_id: int|null}
     */
    public function execute(Item $item, bool $force = false): array
    {
        if (! $force && $item->thumbnail_is_manual) {
            return ['changed' => false, 'reason' => 'manual', 'view' => '', 'media_id' => null];
        }

        $view    = $this->resolveView($item);
        $desired = $view === SpeciesThumbnailView::VIEW_SIDE ? 'photo_side' : 'photo_top';

        // 画像メディアのみ（動画はサムネ不可）。
        $images = $item->media()
            ->where('media_type', 'like', 'photo%')
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();

        if ($images->isEmpty()) {
            return ['changed' => false, 'reason' => 'no_photo', 'view' => $view, 'media_id' => null];
        }

        // 1) 希望の向きに一致する写真があればそれを採用。
        $target = $images->firstWhere('media_type', $desired);
        if ($target !== null) {
            $changed = $this->assignThumbnail($item, $target);
            return ['changed' => $changed, 'reason' => 'matched', 'view' => $view, 'media_id' => $target->id];
        }

        // 2) 一致写真なし。既にサムネがあれば壊さず据え置き（向き写真の到着待ち）。
        if ($images->firstWhere('is_thumbnail', true) !== null) {
            return ['changed' => false, 'reason' => 'no_match_kept', 'view' => $view, 'media_id' => null];
        }

        // 3) サムネ未設定なら暫定で先頭の写真を立てる（後で正しい向きが来たら切り替わる）。
        $interim = $images->first();
        $changed = $this->assignThumbnail($item, $interim);

        return ['changed' => $changed, 'reason' => 'interim', 'view' => $view, 'media_id' => $interim->id];
    }

    /** 生体名（前後trim）から撮影ビューを引く。未登録は上見(top)デフォルト。 */
    private function resolveView(Item $item): string
    {
        $name = trim((string) $item->species_name);
        if ($name === '') {
            return SpeciesThumbnailView::VIEW_TOP;
        }

        return SpeciesThumbnailView::where('species_name', $name)->value('thumbnail_view')
            ?? SpeciesThumbnailView::VIEW_TOP;
    }

    /**
     * 指定メディアをサムネにする（他は解除）。自動適用なので manual フラグは false に維持。
     * 既に同じ状態なら何もせず false を返す（冪等）。
     */
    private function assignThumbnail(Item $item, ItemMedia $media): bool
    {
        $url = $this->storage->url($media->file_path);

        $alreadyApplied = $media->is_thumbnail
            && (string) $item->thumbnail_path === (string) $url
            && ! $item->thumbnail_is_manual;

        ItemMedia::where('item_id', $item->id)
            ->where('id', '!=', $media->id)
            ->where('is_thumbnail', true)
            ->update(['is_thumbnail' => false]);

        if (! $media->is_thumbnail) {
            $media->is_thumbnail = true;
            $media->save();
        }

        $item->thumbnail_path      = $url;
        $item->thumbnail_is_manual = false;
        $item->save();

        return ! $alreadyApplied;
    }
}
