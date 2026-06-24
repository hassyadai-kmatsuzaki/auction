<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;

/**
 * 生体名（items.species_name）→ サムネ向き（上見/横見）の軽量マッピング。
 * 品種マスタではなく「撮影ビュー設定」だけを持つ。
 */
class SpeciesThumbnailView extends BaseModel
{
    public const VIEW_TOP  = 'top';   // 上見
    public const VIEW_SIDE = 'side';  // 横見

    protected $fillable = [
        'species_name',
        'thumbnail_view',
    ];

    /**
     * 「ビュー未設定」の生体名を items から導出するクエリ。
     * = items に出現する species_name のうち、この表に未登録のもの。
     * 収集テーブルを持たず実データから導出するため、初回分・後追い分とも取りこぼさない。
     *
     * 一覧（件数集計つき）とダッシュボードのカウントで共有する。
     */
    public static function unregisteredItemsQuery(): Builder
    {
        return Item::query()
            ->whereNotNull('species_name')
            ->where('species_name', '!=', '')
            ->whereNotIn('species_name', function ($q) {
                $q->select('species_name')->from((new self)->getTable());
            });
    }
}
