<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use App\Models\Favorite;
use App\Models\Item;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class FavoriteController extends Controller
{
    /**
     * お気に入り一覧を取得
     */
    public function index(Request $request)
    {
        $userId = Auth::id();

        $favorites = Favorite::where('user_id', $userId)
            ->with(['item.auction', 'item.media'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'favorites' => $favorites->map(function ($fav) {
                    $item = $fav->item;
                    if (!$item) return null;
                    return [
                        'id' => $fav->id,
                        'item_id' => $item->id,
                        'item_number' => $item->item_number,
                        'species_name' => $item->species_name,
                        'quantity' => $item->quantity,
                        'start_price' => $item->start_price,
                        'current_price' => $item->current_price,
                        'estimated_price' => $item->estimated_price,
                        'inspection_info' => $item->inspection_info,
                        'individual_info' => $item->individual_info,
                        'is_premium' => $item->is_premium,
                        'thumbnail_path' => $item->thumbnail_path,
                        'status' => $item->status,
                        'media' => $item->media,
                        'auction' => $item->auction ? [
                            'id' => $item->auction->id,
                            'title' => $item->auction->title,
                            'event_date' => $item->auction->event_date->format('Y-m-d'),
                            'status' => $item->auction->status,
                        ] : null,
                        'created_at' => $fav->created_at->toIso8601String(),
                    ];
                })->filter()->values(),
            ],
        ]);
    }

    /**
     * お気に入り登録/解除（トグル）
     */
    public function toggle(Request $request)
    {
        $request->validate([
            'item_id' => 'required|integer|exists:items,id',
        ]);

        $userId = Auth::id();
        $itemId = $request->item_id;

        $existing = Favorite::where('user_id', $userId)
            ->where('item_id', $itemId)
            ->first();

        if ($existing) {
            $existing->delete();
            return response()->json([
                'success' => true,
                'is_favorited' => false,
                'message' => 'お気に入りを解除しました。',
            ]);
        }

        Favorite::create([
            'user_id' => $userId,
            'item_id' => $itemId,
        ]);

        return response()->json([
            'success' => true,
            'is_favorited' => true,
            'message' => 'お気に入りに追加しました。',
        ]);
    }

    /**
     * 特定オークションのアイテムのお気に入り状態を一括取得
     */
    public function checkBulk(Request $request)
    {
        $request->validate([
            'item_ids' => 'required|array',
            'item_ids.*' => 'integer',
        ]);

        $userId = Auth::id();

        $favoriteItemIds = Favorite::where('user_id', $userId)
            ->whereIn('item_id', $request->item_ids)
            ->pluck('item_id')
            ->toArray();

        return response()->json([
            'success' => true,
            'data' => [
                'favorite_item_ids' => $favoriteItemIds,
            ],
        ]);
    }
}
