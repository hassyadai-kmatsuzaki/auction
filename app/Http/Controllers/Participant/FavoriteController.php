<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use App\Models\Favorite;
use App\Models\Item;
use App\Services\TestModeService;
use App\Traits\MediaUrlTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class FavoriteController extends Controller
{
    use MediaUrlTrait;

    public function __construct(private readonly TestModeService $testMode) {}

    /**
     * お気に入り一覧を取得
     */
    public function index(Request $request)
    {
        $userId = Auth::id();
        $includePast = $request->boolean('include_past', false);

        $favoritesQuery = Favorite::where('user_id', $userId)
            ->with(['item.auction', 'item.media', 'item.sellerProfile']);

        // テストモード ON で許可ユーザーでなければ空にする（許可ユーザーには全件見せる）
        if ($this->testMode->isEnabled() && !$this->testMode->currentUserCanSeeTestUniverse(Auth::user())) {
            $favoritesQuery->whereRaw('1=0');
        }

        $favorites = $favoritesQuery->orderBy('created_at', 'desc')->get();

        $mapped = $favorites->map(function ($fav) {
            $item = $fav->item;
            if (!$item) return null;
            $auction = $item->auction;
            $isAnon = (bool) $item->is_anonymous;
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
                'is_anonymous' => $isAnon,
                'thumbnail_path' => $item->thumbnail_path,
                'status' => $item->status,
                'media' => $this->transformMedia($item->media),
                'seller' => $isAnon
                    ? [
                        'id'                 => null,
                        'seller_code'        => null,
                        'seller_name'        => '匿名出品',
                        'profile_image_url'  => null,
                    ]
                    : ($item->sellerProfile ? [
                        'id'                 => $item->sellerProfile->id,
                        'seller_code'        => $item->sellerProfile->seller_code,
                        'seller_name'        => $item->sellerProfile->seller_name,
                        'profile_image_url'  => $item->sellerProfile->profile_image_url,
                    ] : null),
                'auction' => $auction ? [
                    'id' => $auction->id,
                    'title' => $auction->title,
                    'event_date' => $auction->event_date->format('Y-m-d'),
                    'status' => $auction->status,
                    'is_past' => in_array($auction->status, ['finished', 'cancelled'], true)
                        || $auction->event_date->lt(now()->startOfDay()),
                ] : null,
                'created_at' => $fav->created_at->toIso8601String(),
            ];
        })->filter();

        if (! $includePast) {
            $mapped = $mapped->reject(fn ($f) => $f['auction'] && $f['auction']['is_past']);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'favorites' => $mapped->values(),
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
