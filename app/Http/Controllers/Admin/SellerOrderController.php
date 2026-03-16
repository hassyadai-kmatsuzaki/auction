<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\AuctionSellerOrder;
use App\Models\Item;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class SellerOrderController extends Controller
{
    /**
     * 出品者順序一覧取得
     */
    public function index($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        // 出品者順序を取得（display_order 昇順）
        $sellerOrders = AuctionSellerOrder::where('auction_id', $auctionId)
            ->with('sellerProfile.user')
            ->orderBy('display_order')
            ->get();

        // 全出品者の生体を一括取得し seller_profile_id でグループ化（N+1 回避）
        $sellerProfileIds = $sellerOrders->pluck('seller_profile_id')->toArray();
        $allItems = Item::where('auction_id', $auctionId)
            ->whereIn('seller_profile_id', $sellerProfileIds)
            ->orderByRaw('seller_display_order IS NULL, seller_display_order, item_number')
            ->get(['id', 'item_number', 'species_name', 'quantity', 'thumbnail_path', 'seller_display_order', 'is_premium', 'status', 'seller_profile_id'])
            ->groupBy('seller_profile_id');

        $sellerOrders = $sellerOrders->map(function ($order) use ($allItems) {
                $items = $allItems->get($order->seller_profile_id, collect());

                return [
                    'id' => $order->id,
                    'seller_profile_id' => $order->seller_profile_id,
                    'seller_name' => $order->sellerProfile->seller_name
                        ?? $order->sellerProfile->corporate_name
                        ?? $order->sellerProfile->user?->name
                        ?? '不明',
                    'seller_code' => $order->sellerProfile->seller_code ?? null,
                    'display_order' => $order->display_order,
                    'item_count' => $items->count(),
                    'items' => $items->values(),
                ];
            });

        // オークションステータスが live 以降は編集不可
        $isEditable = in_array($auction->status, ['preparing', 'scheduled']);

        return response()->json([
            'success' => true,
            'data' => [
                'seller_orders' => $sellerOrders,
                'is_editable' => $isEditable,
            ],
        ]);
    }

    /**
     * 出品者順序のランダム化
     */
    public function randomize($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        // バリデーション: オークションステータスチェック
        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => 'オークションが開始済みのため、出品者順序を変更できません。',
            ], 400);
        }

        // 対象オークションの全生体から seller_profile_id を DISTINCT で取得
        $sellerProfileIds = Item::where('auction_id', $auctionId)
            ->whereNotNull('seller_profile_id')
            ->distinct()
            ->pluck('seller_profile_id')
            ->toArray();

        if (empty($sellerProfileIds)) {
            return response()->json([
                'success' => false,
                'message' => 'オークションに出品者が紐づく生体がありません。',
            ], 400);
        }

        // 出品者リストをランダム化
        shuffle($sellerProfileIds);

        DB::beginTransaction();
        try {
            // 既存の出品者順序を削除
            AuctionSellerOrder::where('auction_id', $auctionId)->delete();

            // 新しい順序で保存
            foreach ($sellerProfileIds as $index => $sellerProfileId) {
                AuctionSellerOrder::create([
                    'auction_id' => $auctionId,
                    'seller_profile_id' => $sellerProfileId,
                    'display_order' => $index + 1,
                ]);

                // 各出品者内の生体に seller_display_order を設定（未設定の場合のみ）
                $items = Item::where('auction_id', $auctionId)
                    ->where('seller_profile_id', $sellerProfileId)
                    ->whereNull('seller_display_order')
                    ->orderBy('item_number')
                    ->get();

                foreach ($items as $itemIndex => $item) {
                    $item->seller_display_order = $itemIndex + 1;
                    $item->save();
                }
            }

            DB::commit();

            // レスポンス用データを取得
            $sellerOrders = AuctionSellerOrder::where('auction_id', $auctionId)
                ->with('sellerProfile')
                ->orderBy('display_order')
                ->get()
                ->map(function ($order) use ($auctionId) {
                    $itemCount = Item::where('auction_id', $auctionId)
                        ->where('seller_profile_id', $order->seller_profile_id)
                        ->count();

                    return [
                        'seller_profile_id' => $order->seller_profile_id,
                        'seller_name' => $order->sellerProfile->seller_name
                        ?? $order->sellerProfile->corporate_name
                        ?? $order->sellerProfile->user?->name
                        ?? '不明',
                        'display_order' => $order->display_order,
                        'item_count' => $itemCount,
                    ];
                });

            return response()->json([
                'success' => true,
                'message' => '出品者の表示順序をランダムに設定しました。',
                'data' => [
                    'seller_orders' => $sellerOrders,
                ],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => '出品者順序のランダム化に失敗しました。',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * 出品者順序の手動更新
     */
    public function reorder(Request $request, $auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        // バリデーション: オークションステータスチェック
        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => 'オークションが開始済みのため、出品者順序を変更できません。',
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'seller_orders' => 'required|array|min:1',
            'seller_orders.*.seller_profile_id' => 'required|exists:seller_profiles,id',
            'seller_orders.*.display_order' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'バリデーションエラー',
                'errors' => $validator->errors(),
            ], 422);
        }

        DB::beginTransaction();
        try {
            foreach ($request->seller_orders as $orderData) {
                AuctionSellerOrder::updateOrCreate(
                    [
                        'auction_id' => $auctionId,
                        'seller_profile_id' => $orderData['seller_profile_id'],
                    ],
                    [
                        'display_order' => $orderData['display_order'],
                    ]
                );
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => '出品者の表示順序を更新しました。',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => '出品者順序の更新に失敗しました。',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * 出品者内の生体順序の更新
     */
    public function reorderItems(Request $request, $auctionId, $sellerProfileId)
    {
        $auction = Auction::findOrFail($auctionId);

        // バリデーション: オークションステータスチェック
        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => 'オークションが開始済みのため、生体順序を変更できません。',
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.item_id' => 'required|exists:items,id',
            'items.*.seller_display_order' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'バリデーションエラー',
                'errors' => $validator->errors(),
            ], 422);
        }

        DB::beginTransaction();
        try {
            foreach ($request->items as $itemData) {
                $item = Item::where('id', $itemData['item_id'])
                    ->where('auction_id', $auctionId)
                    ->where('seller_profile_id', $sellerProfileId)
                    ->first();

                if ($item) {
                    $item->seller_display_order = $itemData['seller_display_order'];
                    $item->save();
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => '出品者内の生体順序を更新しました。',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => '生体順序の更新に失敗しました。',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
