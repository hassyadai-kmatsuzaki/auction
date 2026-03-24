<?php

namespace App\Actions\Line;

use App\Models\Favorite;
use App\Models\Item;
use App\Models\Lane;
use App\Services\NotificationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * お気に入り順番接近通知
 *
 * 商品が切り替わった時、同一レーンで5個後の商品をお気に入りしているユーザーに通知する
 */
class NotifyFavoriteApproachingAction
{
    private const NOTIFY_AHEAD_COUNT = 5;

    public function execute(Lane $lane, Item $currentItem): void
    {
        try {
            $lane->loadMissing('auction');
            if (!$lane->auction) return;

            // 現在の商品のシーケンス順を取得
            $currentSequence = DB::table('lane_items')
                ->where('lane_id', $lane->id)
                ->where('item_id', $currentItem->id)
                ->value('sequence_order');

            if ($currentSequence === null) return;

            // 5個先までの商品IDを取得
            $upcomingItemIds = DB::table('lane_items')
                ->join('items', 'lane_items.item_id', '=', 'items.id')
                ->where('lane_items.lane_id', $lane->id)
                ->where('lane_items.sequence_order', '>', $currentSequence)
                ->where('lane_items.sequence_order', '<=', $currentSequence + self::NOTIFY_AHEAD_COUNT)
                ->where('items.status', 'registered')
                ->pluck('items.id')
                ->toArray();

            if (empty($upcomingItemIds)) return;

            // これらの商品をお気に入りしているユーザーを取得
            $favorites = Favorite::whereIn('item_id', $upcomingItemIds)
                ->with('item')
                ->get();

            $notificationService = app(NotificationService::class);

            foreach ($favorites as $favorite) {
                $item = $favorite->item;
                if (!$item) continue;

                $remainingCount = DB::table('lane_items')
                    ->join('items', 'lane_items.item_id', '=', 'items.id')
                    ->where('lane_items.lane_id', $lane->id)
                    ->where('lane_items.sequence_order', '>', $currentSequence)
                    ->where('lane_items.sequence_order', '<', function ($q) use ($lane, $item) {
                        $q->select('sequence_order')->from('lane_items')
                          ->where('lane_id', $lane->id)->where('item_id', $item->id);
                    })
                    ->where('items.status', 'registered')
                    ->count();

                $ahead = $remainingCount + 1;

                try {
                    $notificationService->sendFavoriteApproachingNotification(
                        $favorite->user_id,
                        $item->species_name,
                        $ahead,
                        "レーン{$lane->lane_number}",
                        $lane->auction->title
                    );
                } catch (\Exception $e) {
                    Log::warning("Favorite notification error: user={$favorite->user_id} - " . $e->getMessage());
                }
            }

            if ($favorites->isNotEmpty()) {
                Log::info("Favorite approaching notifications: lane={$lane->id}, notified=" . $favorites->count());
            }
        } catch (\Exception $e) {
            Log::warning("Favorite approaching notification error: " . $e->getMessage());
        }
    }
}
