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
     * 突合は前後スペースを TRIM して行う（登録側も保存時に trim 済み）。
     * これにより「白ブチ 」と「白ブチ」が別物として未設定に湧くのを防ぐ。
     * ※ ひらがな/カタカナ・漢字の正規化は意図的に行わない（別品種の誤統合を避けるため運用で個別登録）。
     *
     * 一覧（件数集計つき）とダッシュボードのカウントで共有する。
     */
    public static function unregisteredItemsQuery(): Builder
    {
        $table = (new self)->getTable();

        return Item::query()
            ->whereNotNull('species_name')
            ->whereRaw('TRIM(species_name) <> ?', [''])
            ->whereRaw("TRIM(species_name) NOT IN (SELECT species_name FROM {$table})");
    }
}
