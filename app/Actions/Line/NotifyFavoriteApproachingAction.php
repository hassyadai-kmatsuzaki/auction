<?php

namespace App\Actions\Line;

use App\Models\Favorite;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SystemSetting;
use App\Services\NotificationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * お気に入り順番接近通知
 *
 * 商品が切り替わった時、同一レーンでちょうど3個後の商品をお気に入りしているユーザーに通知する
 *
 * B-5 (2026-09-08): 旧実装は「お気に入り1件ごとに残り件数を数える SQL」を発行していた（N+1）。
 *   対象商品は sequence = 現在+3 の 1 件に決まっているので、残り件数は商品ごとに 1 回だけ数える。
 *   500 名開催でお気に入りが数百件付いた商品でも、SQL は固定で 4 本。
 * B-6 (2026-09-08): 縮退スイッチ live_notify_favorite_approaching が OFF なら何もしない。
 */
class NotifyFavoriteApproachingAction
{
    private const NOTIFY_AHEAD_COUNT = 3;

    public function execute(Lane $lane, Item $currentItem): void
    {
        try {
            if (!SystemSetting::get('live_notify_favorite_approaching', true)) {
                return;
            }

            $lane->loadMissing('auction');
            if (!$lane->auction) return;

            // 現在の商品のシーケンス順を取得
            $currentSequence = DB::table('lane_items')
                ->where('lane_id', $lane->id)
                ->where('item_id', $currentItem->id)
                ->value('sequence_order');

            if ($currentSequence === null) return;

            // ちょうどNOTIFY_AHEAD_COUNT個先の商品（ピンポイント発火で多重送信を防ぐ）
            $upcoming = DB::table('lane_items')
                ->join('items', 'lane_items.item_id', '=', 'items.id')
                ->where('lane_items.lane_id', $lane->id)
                ->where('lane_items.sequence_order', '=', $currentSequence + self::NOTIFY_AHEAD_COUNT)
                ->where('items.status', 'registered')
                ->get(['items.id', 'lane_items.sequence_order']);

            if ($upcoming->isEmpty()) return;

            // 商品ごとの「あと何番目か」を 1 回だけ計算（現在より後ろ・対象より前の registered 件数 + 1）
            $aheadByItem = [];
            foreach ($upcoming as $row) {
                $between = DB::table('lane_items')
                    ->join('items', 'lane_items.item_id', '=', 'items.id')
                    ->where('lane_items.lane_id', $lane->id)
                    ->where('lane_items.sequence_order', '>', $currentSequence)
                    ->where('lane_items.sequence_order', '<', $row->sequence_order)
                    ->where('items.status', 'registered')
                    ->count();
                $aheadByItem[$row->id] = $between + 1;
            }

            // これらの商品をお気に入りしているユーザー（商品名は 1 回のロードで済ませる）
            $favorites = Favorite::whereIn('item_id', array_keys($aheadByItem))
                ->with('item:id,species_name')
                ->get();

            if ($favorites->isEmpty()) return;

            $notificationService = app(NotificationService::class);
            $laneName    = "レーン{$lane->lane_number}";
            $auctionTitle = $lane->auction->title;
            $auctionId    = (int) $lane->auction_id;
            $sent = 0;

            foreach ($favorites as $favorite) {
                $item = $favorite->item;
                if (!$item) continue;

                try {
                    $notificationService->sendFavoriteApproachingNotification(
                        $favorite->user_id,
                        $item->species_name,
                        $aheadByItem[$favorite->item_id] ?? self::NOTIFY_AHEAD_COUNT,
                        $laneName,
                        $auctionTitle,
                        $auctionId,
                    );
                    $sent++;
                } catch (\Exception $e) {
                    Log::warning("Favorite notification error: user={$favorite->user_id} - " . $e->getMessage());
                }
            }

            Log::info("Favorite approaching notifications: lane={$lane->id}, notified={$sent}/{$favorites->count()}");
        } catch (\Exception $e) {
            Log::warning("Favorite approaching notification error: " . $e->getMessage());
        }
    }
}
