<?php

namespace App\Services;

use App\Models\ActivityEvent;
use App\Models\Item;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * ユーザー行動計測イベントの記録を一手に引き受けるサービス。
 *
 * 設計上の鉄則:
 *   1. 記録失敗は絶対に本処理を止めない（すべて try/catch で握る）。
 *      （過去のカウントダウン Log 権限事故＝ログ失敗で本処理停止、の再発防止）
 *   2. 入札のロック/トランザクション内から呼ばない。呼び出し側で commit 後に叩く。
 *   3. ログインユーザーのみ計測（user_id 必須）。未ログインは記録しない。
 *   4. 高頻度イベントは Redis 当日フラグで2回目以降を弾き、DB に触れる回数を最小化。
 *      DB 側の dedup_key unique が最終的な重複排除の担保（Redis 不通時の保険）。
 */
class ActivityLogger
{
    /**
     * 汎用記録。呼び出し側は基本これではなく下の専用メソッドを使う。
     *
     * @param array $ctx user_id / auction_id / item_id / meta / event_date / dedup_key
     */
    public static function log(string $eventType, array $ctx = []): void
    {
        try {
            $userId = $ctx['user_id'] ?? Auth::id();
            if (!$userId) {
                return; // ログインユーザーのみ
            }

            // 重複排除キーがあり、当日フラグで既出なら DB に触れず終了
            $dedupKey = $ctx['dedup_key'] ?? null;
            if ($dedupKey !== null && !self::claimFirst($dedupKey)) {
                return;
            }

            ActivityEvent::create([
                'user_id'    => $userId,
                'auction_id' => $ctx['auction_id'] ?? null,
                'item_id'    => $ctx['item_id'] ?? null,
                'event_type' => $eventType,
                'meta'       => $ctx['meta'] ?? null,
                'event_date' => $ctx['event_date'] ?? null,
                'dedup_key'  => $dedupKey,
                'ip_address' => request()?->ip(),
                'user_agent' => Str::limit((string) (request()?->userAgent() ?? ''), 500, ''),
            ]);
        } catch (\Throwable $e) {
            // dedup_key の unique 違反（レース）や一時障害はここで吸収する。
            Log::warning('ActivityLogger failed', [
                'event_type' => $eventType,
                'error'      => $e->getMessage(),
            ]);
        }
    }

    // ─── 閲覧系（P2 で track エンドポイントから使用） ──────────────

    /** その日最初のアクセス。1ユーザー1日1行。 */
    public static function dailyAccess(?int $userId = null): void
    {
        $userId = $userId ?? Auth::id();
        if (!$userId) {
            return;
        }
        $ymd = now()->format('Ymd');
        self::log(ActivityEvent::DAILY_ACCESS, [
            'user_id'    => $userId,
            'event_date' => now()->toDateString(),
            'dedup_key'  => "da:{$userId}:{$ymd}",
        ]);
    }

    /**
     * 生体詳細閲覧。オークション開始前（preparing/scheduled）のみ記録。
     * ライブ化以降は記録しない＝当日ピークに書き込まない。
     */
    public static function itemView(int $itemId, ?int $userId = null): void
    {
        $userId = $userId ?? Auth::id();
        if (!$userId) {
            return;
        }
        try {
            $item = Item::query()->with('auction:id,status')->find($itemId);
            if (!$item || !$item->auction) {
                return;
            }
            if (!in_array($item->auction->status, ['preparing', 'scheduled'], true)) {
                return; // 開始済み（live）/終了/中止は対象外
            }
            $ymd = now()->format('Ymd');
            self::log(ActivityEvent::ITEM_VIEW, [
                'user_id'    => $userId,
                'auction_id' => $item->auction_id,
                'item_id'    => $item->id,
                'event_date' => now()->toDateString(),
                'dedup_key'  => "iv:{$userId}:{$item->id}:{$ymd}",
            ]);
        } catch (\Throwable $e) {
            Log::warning('ActivityLogger itemView failed', ['item_id' => $itemId, 'error' => $e->getMessage()]);
        }
    }

    // ─── 確実系 ──────────────────────────────────────────────

    /** 「オークション会場へ」ボタン。1ユーザー1オークション1行（ライブ中も可）。 */
    public static function venueEnter(int $auctionId, ?int $userId = null): void
    {
        $userId = $userId ?? Auth::id();
        if (!$userId) {
            return;
        }
        self::log(ActivityEvent::VENUE_ENTER, [
            'user_id'    => $userId,
            'auction_id' => $auctionId,
            'dedup_key'  => "ve:{$userId}:{$auctionId}",
        ]);
    }

    /** お気に入り登録。$auto=true は指値設定時の自動付与分。 */
    public static function favoriteAdd(int $itemId, ?int $auctionId, bool $auto = false, ?int $userId = null): void
    {
        self::log(ActivityEvent::FAVORITE_ADD, [
            'user_id'    => $userId ?? Auth::id(),
            'auction_id' => $auctionId,
            'item_id'    => $itemId,
            'meta'       => ['auto' => $auto],
        ]);
    }

    /** お気に入り解除。 */
    public static function favoriteRemove(int $itemId, ?int $auctionId, ?int $userId = null): void
    {
        self::log(ActivityEvent::FAVORITE_REMOVE, [
            'user_id'    => $userId ?? Auth::id(),
            'auction_id' => $auctionId,
            'item_id'    => $itemId,
        ]);
    }

    /** 指値設定。 */
    public static function bidLimitSet(int $itemId, ?int $auctionId, float $limitPrice, ?int $userId = null): void
    {
        self::log(ActivityEvent::BID_LIMIT_SET, [
            'user_id'    => $userId ?? Auth::id(),
            'auction_id' => $auctionId,
            'item_id'    => $itemId,
            'meta'       => ['limit_price' => $limitPrice],
        ]);
    }

    /** 指値解除。 */
    public static function bidLimitRemove(int $itemId, ?int $auctionId, ?float $limitPrice = null, ?int $userId = null): void
    {
        self::log(ActivityEvent::BID_LIMIT_REMOVE, [
            'user_id'    => $userId ?? Auth::id(),
            'auction_id' => $auctionId,
            'item_id'    => $itemId,
            'meta'       => $limitPrice !== null ? ['limit_price' => $limitPrice] : null,
        ]);
    }

    /** ログイン。 */
    public static function login(int $userId): void
    {
        self::log(ActivityEvent::LOGIN, ['user_id' => $userId]);
    }

    /**
     * Redis 当日フラグで初回だけ true。2回目以降は false（DB に触れない）。
     * Redis 不通時は true を返し、DB の dedup_key unique に重複排除を委ねる。
     */
    private static function claimFirst(string $key): bool
    {
        try {
            // add() は SETNX 相当。存在しなければ true を返してセット。当日末で失効。
            return (bool) Cache::store('redis')->add('act:' . $key, 1, now()->endOfDay());
        } catch (\Throwable $e) {
            return true;
        }
    }
}
