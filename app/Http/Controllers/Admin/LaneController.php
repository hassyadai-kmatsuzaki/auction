<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class LaneController extends Controller
{
    /**
     * レーン一覧と割り当て状況を取得
     */
    public function index($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);
        
        // レーンが1つもない場合のみ初期レーンを作成
        if ($auction->lanes()->count() === 0) {
            $this->createInitialLanes($auction);
        }
        
        $lanes = $auction->lanes()
            ->with(['items' => function ($query) {
                $query->select('items.id', 'item_number', 'species_name', 'quantity', 'start_price', 'is_premium', 'status', 'thumbnail_path')
                    ->orderBy('lane_items.sequence_order');
            }])
            ->orderBy('lane_number')
            ->get();

        // 未割り当ての生体
        $assignedItemIds = $lanes->flatMap(fn($lane) => $lane->items->pluck('id'))->toArray();
        $unassignedItems = Item::where('auction_id', $auctionId)
            ->where('status', 'registered')
            ->whereNotIn('id', $assignedItemIds)
            ->orderBy('item_number')
            ->get(['id', 'item_number', 'species_name', 'quantity', 'start_price', 'is_premium', 'status', 'thumbnail_path']);

        return response()->json([
            'success' => true,
            'data' => [
                'auction' => [
                    'id' => $auction->id,
                    'title' => $auction->title,
                    'status' => $auction->status,
                    'lane_count' => $auction->lane_count,
                ],
                'lanes' => $lanes->map(function ($lane) {
                    return [
                        'id' => $lane->id,
                        'lane_number' => $lane->lane_number,
                        'lane_name' => $lane->lane_name,
                        'status' => $lane->status,
                        'items' => $lane->items->map(function ($item) {
                            return [
                                'id' => $item->id,
                                'item_number' => $item->item_number,
                                'species_name' => $item->species_name,
                                'quantity' => $item->quantity,
                                'start_price' => $item->start_price,
                                'is_premium' => $item->is_premium,
                                'status' => $item->status,
                                'thumbnail_path' => $item->thumbnail_path,
                                'sequence_order' => $item->pivot->sequence_order,
                            ];
                        }),
                    ];
                }),
                'unassigned_items' => $unassignedItems->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'item_number' => $item->item_number,
                        'species_name' => $item->species_name,
                        'quantity' => $item->quantity,
                        'start_price' => $item->start_price,
                        'is_premium' => $item->is_premium,
                        'status' => $item->status,
                        'thumbnail_path' => $item->thumbnail_path,
                    ];
                }),
                'statistics' => [
                    'total_items' => Item::where('auction_id', $auctionId)->where('status', 'registered')->count(),
                    'assigned_items' => count($assignedItemIds),
                    'unassigned_items' => $unassignedItems->count(),
                ],
            ],
        ]);
    }

    /**
     * レーンを追加
     */
    public function createLane(Request $request, $auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => '開始済みのオークションにレーンを追加できません。',
            ], 400);
        }

        // 最大10レーン
        $currentCount = $auction->lanes()->count();
        if ($currentCount >= 10) {
            return response()->json([
                'success' => false,
                'message' => 'レーンは最大10個までです。',
            ], 400);
        }

        // 次のレーン番号を取得
        $maxLaneNumber = $auction->lanes()->max('lane_number') ?? 0;
        $newLaneNumber = $maxLaneNumber + 1;

        $laneName = $request->input('lane_name', null);

        $lane = Lane::create([
            'auction_id' => $auction->id,
            'lane_number' => $newLaneNumber,
            'lane_name' => $laneName,
            'status' => 'waiting',
        ]);

        // auction.lane_count を同期
        $this->syncLaneCount($auction);

        return response()->json([
            'success' => true,
            'message' => 'レーン' . $newLaneNumber . 'を追加しました。',
            'data' => [
                'lane' => [
                    'id' => $lane->id,
                    'lane_number' => $lane->lane_number,
                    'lane_name' => $lane->lane_name,
                    'status' => $lane->status,
                ],
            ],
        ]);
    }

    /**
     * レーンを削除（空のレーンのみ）
     */
    public function deleteLane($auctionId, $laneId)
    {
        $auction = Auction::findOrFail($auctionId);

        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => '開始済みのオークションのレーンを削除できません。',
            ], 400);
        }

        $lane = Lane::where('auction_id', $auctionId)->where('id', $laneId)->firstOrFail();

        // レーンにアイテムが割り当てられている場合
        $itemCount = DB::table('lane_items')->where('lane_id', $laneId)->count();
        if ($itemCount > 0) {
            // アイテムを先に解除
            DB::table('lane_items')->where('lane_id', $laneId)->delete();
        }

        // 最低1レーンは必要
        if ($auction->lanes()->count() <= 1) {
            return response()->json([
                'success' => false,
                'message' => '最低1つのレーンが必要です。',
            ], 400);
        }

        $deletedNumber = $lane->lane_number;
        $lane->delete();

        // 残りのレーンの番号を詰め直す
        $this->renumberLanes($auction);

        // auction.lane_count を同期
        $this->syncLaneCount($auction);

        return response()->json([
            'success' => true,
            'message' => 'レーン' . $deletedNumber . 'を削除しました。' . ($itemCount > 0 ? "（{$itemCount}件の割り当ても解除されました）" : ''),
        ]);
    }

    /**
     * レーン名を更新
     */
    public function updateLane(Request $request, $auctionId, $laneId)
    {
        $auction = Auction::findOrFail($auctionId);

        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => '開始済みのオークションのレーンを編集できません。',
            ], 400);
        }

        $lane = Lane::where('auction_id', $auctionId)->where('id', $laneId)->firstOrFail();

        $validator = Validator::make($request->all(), [
            'lane_name' => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $lane->update([
            'lane_name' => $request->input('lane_name'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'レーン名を更新しました。',
        ]);
    }

    /**
     * 生体をレーンに割り当て（レーン間移動・新規割り当て・並び替えすべて対応）
     */
    public function assignItem(Request $request, $auctionId, $laneId)
    {
        $validator = Validator::make($request->all(), [
            'item_id' => 'required|exists:items,id',
            'position' => 'nullable|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $lane = Lane::where('auction_id', $auctionId)->where('id', $laneId)->firstOrFail();
        $item = Item::where('auction_id', $auctionId)->where('id', $request->item_id)->firstOrFail();

        try {
            DB::transaction(function () use ($laneId, $item, $request) {
                // 既存の割り当てを確認
                $existing = DB::table('lane_items')
                    ->where('item_id', $item->id)
                    ->lockForUpdate()
                    ->first();

                // 既に割り当て済みなら削除（同一レーン内の並び替えも含む）
                if ($existing) {
                    DB::table('lane_items')->where('item_id', $item->id)->delete();

                    // 元のレーンの順序を詰める
                    $this->resequenceLane($existing->lane_id);
                }

                // 挿入位置を決定
                $position = $request->input('position');
                $maxSequence = DB::table('lane_items')
                    ->where('lane_id', $laneId)
                    ->max('sequence_order') ?? 0;

                if ($position !== null && $position <= $maxSequence) {
                    // 指定位置に挿入するため、既存アイテムの順序をずらす
                    DB::table('lane_items')
                        ->where('lane_id', $laneId)
                        ->where('sequence_order', '>=', $position)
                        ->increment('sequence_order');
                    $sequenceOrder = $position;
                } else {
                    // 末尾に追加
                    $sequenceOrder = $maxSequence + 1;
                }

                // レーンに割り当て
                DB::table('lane_items')->insert([
                    'lane_id' => $laneId,
                    'item_id' => $item->id,
                    'sequence_order' => $sequenceOrder,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
        } catch (\Illuminate\Database\QueryException $e) {
            if ($e->errorInfo[1] === 1062) {
                return response()->json([
                    'success' => false,
                    'message' => 'この生体は既にレーンに割り当て済みです。',
                ], 409);
            }
            throw $e;
        }

        return response()->json([
            'success' => true,
            'message' => '生体をレーンに割り当てました。',
        ]);
    }

    /**
     * レーンから生体を削除
     */
    public function removeItem($auctionId, $laneId, $itemId)
    {
        $lane = Lane::where('auction_id', $auctionId)->where('id', $laneId)->firstOrFail();
        
        $deleted = DB::table('lane_items')
            ->where('lane_id', $laneId)
            ->where('item_id', $itemId)
            ->delete();

        if (!$deleted) {
            return response()->json([
                'success' => false,
                'message' => '生体がこのレーンに割り当てられていません。',
            ], 404);
        }

        // 順序を詰める
        $this->resequenceLane($laneId);

        return response()->json([
            'success' => true,
            'message' => 'レーンから生体を削除しました。',
        ]);
    }

    /**
     * レーン内の順序を変更
     */
    public function reorderItems(Request $request, $auctionId, $laneId)
    {
        $validator = Validator::make($request->all(), [
            'item_ids' => 'required|array',
            'item_ids.*' => 'exists:items,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $lane = Lane::where('auction_id', $auctionId)->where('id', $laneId)->firstOrFail();

        DB::transaction(function () use ($laneId, $request) {
            foreach ($request->item_ids as $index => $itemId) {
                DB::table('lane_items')
                    ->where('lane_id', $laneId)
                    ->where('item_id', $itemId)
                    ->update(['sequence_order' => $index + 1, 'updated_at' => now()]);
            }
        });

        return response()->json([
            'success' => true,
            'message' => '順序を更新しました。',
        ]);
    }

    /**
     * 自動割り当て
     */
    public function autoAssign(Request $request, $auctionId)
    {
        $auction = Auction::findOrFail($auctionId);
        
        // オークションが準備中または予定でないと割り当て不可
        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => 'オークションが開始済みのため、自動割り当てできません。',
            ], 400);
        }

        // 既存の割り当てをクリア
        $clearExisting = $request->boolean('clear_existing', false);
        if ($clearExisting) {
            DB::table('lane_items')
                ->whereIn('lane_id', $auction->lanes()->pluck('id'))
                ->delete();
        }

        // 出品者順序が設定されているかチェック
        $hasSellerOrder = \App\Models\AuctionSellerOrder::where('auction_id', $auctionId)->exists();

        if ($hasSellerOrder) {
            // 出品者順序に基づいて生体を取得
            $items = $this->getItemsBySellerOrder($auctionId);
        } else {
            // 従来通りの取得方法（プレミアム優先、item_number順）
            $items = $this->getItemsByItemNumber($auctionId);
        }

        // 既に割り当て済みを除外（全レーン横断で確認）
        $assignedIds = DB::table('lane_items')
            ->pluck('item_id')
            ->toArray();
        
        $items = $items->filter(fn($item) => !in_array($item->id, $assignedIds));

        // レーンに均等に割り当て
        $lanes = $auction->lanes()->orderBy('lane_number')->get();
        $laneCount = $lanes->count();

        if ($laneCount === 0) {
            return response()->json([
                'success' => false,
                'message' => 'レーンがありません。先にレーンを追加してください。',
            ], 400);
        }

        $itemIndex = 0;
        foreach ($items as $item) {
            $laneIndex = $itemIndex % $laneCount;
            $lane = $lanes[$laneIndex];
            
            // 既に割り当て済みの場合はスキップ（レースコンディション対策）
            $alreadyAssigned = DB::table('lane_items')->where('item_id', $item->id)->exists();
            if ($alreadyAssigned) {
                continue;
            }

            $maxSequence = DB::table('lane_items')
                ->where('lane_id', $lane->id)
                ->max('sequence_order') ?? 0;

            try {
                DB::table('lane_items')->insert([
                    'lane_id' => $lane->id,
                    'item_id' => $item->id,
                    'sequence_order' => $maxSequence + 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } catch (\Illuminate\Database\QueryException $e) {
                // UNIQUE制約違反の場合はスキップ（二重クリック等の対策）
                if ($e->errorInfo[1] === 1062) {
                    continue;
                }
                throw $e;
            }

            $itemIndex++;
        }

        return response()->json([
            'success' => true,
            'message' => $itemIndex . '件の生体を自動割り当てしました。',
            'data' => [
                'assigned_count' => $itemIndex,
                'used_seller_order' => $hasSellerOrder,
            ],
        ]);
    }

    /**
     * 出品者順序に基づいて生体を取得
     * 
     * @param int $auctionId
     * @return \Illuminate\Support\Collection
     */
    private function getItemsBySellerOrder($auctionId)
    {
        $sellerOrders = \App\Models\AuctionSellerOrder::where('auction_id', $auctionId)
            ->orderBy('display_order')
            ->get();

        $allItems = collect();

        foreach ($sellerOrders as $sellerOrder) {
            // 各出品者内でプレミアム優先、seller_display_order順（NULLの場合はitem_number順）
            $premiumItems = Item::where('auction_id', $auctionId)
                ->where('seller_profile_id', $sellerOrder->seller_profile_id)
                ->where('status', 'registered')
                ->where('is_premium', true)
                ->orderByRaw('seller_display_order IS NULL, seller_display_order, item_number')
                ->get();

            $normalItems = Item::where('auction_id', $auctionId)
                ->where('seller_profile_id', $sellerOrder->seller_profile_id)
                ->where('status', 'registered')
                ->where(function ($q) {
                    $q->where('is_premium', false)->orWhereNull('is_premium');
                })
                ->orderByRaw('seller_display_order IS NULL, seller_display_order, item_number')
                ->get();

            // 出品者内でプレミアムを先頭に
            $allItems = $allItems->concat($premiumItems)->concat($normalItems);
        }

        return $allItems;
    }

    /**
     * 従来通りの方法で生体を取得（プレミアム優先、item_number順）
     * 
     * @param int $auctionId
     * @return \Illuminate\Support\Collection
     */
    private function getItemsByItemNumber($auctionId)
    {
        $premiumItems = Item::where('auction_id', $auctionId)
            ->where('status', 'registered')
            ->where('is_premium', true)
            ->orderBy('item_number')
            ->get();

        $normalItems = Item::where('auction_id', $auctionId)
            ->where('status', 'registered')
            ->where(function ($q) {
                $q->where('is_premium', false)->orWhereNull('is_premium');
            })
            ->orderBy('item_number')
            ->get();

        return $premiumItems->concat($normalItems);
    }

    /**
     * 全レーンの割り当てを一括解除
     */
    public function bulkUnassign($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        // オークションが準備中または予定でないと操作不可
        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => 'オークションが開始済みのため、割り当て解除できません。',
            ], 400);
        }

        $laneIds = $auction->lanes()->pluck('id');
        $deletedCount = DB::table('lane_items')
            ->whereIn('lane_id', $laneIds)
            ->delete();

        return response()->json([
            'success' => true,
            'message' => $deletedCount . '件のレーン割り当てを解除しました。',
            'data' => [
                'unassigned_count' => $deletedCount,
            ],
        ]);
    }

    /**
     * 初期レーンを作成（レーンが0個の場合のみ）
     */
    private function createInitialLanes(Auction $auction): void
    {
        for ($i = 1; $i <= $auction->lane_count; $i++) {
            Lane::create([
                'auction_id' => $auction->id,
                'lane_number' => $i,
                'status' => 'waiting',
            ]);
        }
    }

    /**
     * レーン番号を詰め直す（削除後に番号が飛ばないようにする）
     */
    private function renumberLanes(Auction $auction): void
    {
        $lanes = $auction->lanes()->orderBy('lane_number')->get();
        $number = 1;
        foreach ($lanes as $lane) {
            if ($lane->lane_number !== $number) {
                $lane->update(['lane_number' => $number]);
            }
            $number++;
        }
    }

    /**
     * auction.lane_count を実際のレーン数に同期
     */
    private function syncLaneCount(Auction $auction): void
    {
        $actualCount = $auction->lanes()->count();
        if ($auction->lane_count !== $actualCount) {
            $auction->update(['lane_count' => $actualCount]);
        }
    }

    /**
     * レーン内の順序を詰める
     */
    private function resequenceLane($laneId): void
    {
        $items = DB::table('lane_items')
            ->where('lane_id', $laneId)
            ->orderBy('sequence_order')
            ->get();

        $sequence = 1;
        foreach ($items as $item) {
            DB::table('lane_items')
                ->where('lane_id', $laneId)
                ->where('item_id', $item->item_id)
                ->update(['sequence_order' => $sequence++]);
        }
    }
}
