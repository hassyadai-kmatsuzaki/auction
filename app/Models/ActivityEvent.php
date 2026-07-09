<?php

namespace App\Models;

/**
 * ユーザー行動計測イベント（閲覧・お気に入り・指値・会場入場・ログイン）。
 * 書き込みは App\Services\ActivityLogger 経由に統一する（直接 create しない）。
 */
class ActivityEvent extends BaseModel
{
    // イベント種別
    public const DAILY_ACCESS     = 'daily_access';     // その日最初のアクセス（1ユーザー1日1行）
    public const ITEM_VIEW        = 'item_view';        // 生体詳細閲覧（開始前のみ・1ユーザー1日×item 1行）
    public const VENUE_ENTER      = 'venue_enter';      // 「会場へ」ボタン（1ユーザー1オークション1行）
    public const FAVORITE_ADD     = 'favorite_add';     // お気に入り登録（meta.auto で手動/自動を区別）
    public const FAVORITE_REMOVE  = 'favorite_remove';  // お気に入り解除
    public const BID_LIMIT_SET    = 'bid_limit_set';    // 指値設定
    public const BID_LIMIT_REMOVE = 'bid_limit_remove'; // 指値解除
    public const LOGIN            = 'login';            // ログイン

    /** created_at は DB の useCurrent 任せ。updated_at は持たない。 */
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'auction_id',
        'item_id',
        'event_type',
        'meta',
        'event_date',
        'dedup_key',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'meta'       => 'array',
        'event_date' => 'date',
        'created_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function auction()
    {
        return $this->belongsTo(Auction::class);
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
