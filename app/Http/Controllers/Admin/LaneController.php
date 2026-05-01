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
                $query->select('items.id', 'item_number', 'species_name', 'quantity', 'start_price', 'is_premium', 'status', 'thumbnail_path', 'seller_profile_id')
                    ->with(['sellerProfile.user'])
                    ->orderBy('lane_items.sequence_order');
            }])
            ->orderBy('lane_number')
            ->get();

        // 未割り当ての生体
        $assignedItemIds = $lanes->flatMap(fn($lane) => $lane->items->pluck('id'))->toArray();
        $unassignedItems = Item::where('auction_id', $auctionId)
            ->where('status', 'registered')
            ->whereNotIn('id', $assignedItemIds)
            ->with(['sellerProfile.user'])
            ->orderBy('item_number')
            ->get();

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
                            $sellerName = null;
                            if ($item->sellerProfile) {
                                $sellerName = $item->sellerProfile->seller_name
                                    ?? $item->sellerProfile->corporate_name
                                    ?? $item->sellerProfile->user?->name
                                    ?? '不明';
                            }
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
                                'seller_profile_id' => $item->seller_profile_id,
                                'seller_name' => $sellerName,
                            ];
                        }),
                    ];
                }),
                'unassigned_items' => $unassignedItems->map(function ($item) {
                    $sellerName = null;
                    if ($item->sellerProfile) {
                        $sellerName = $item->sellerProfile->seller_name
                            ?? $item->sellerProfile->corporate_name
                            ?? $item->sellerProfile->user?->name
                            ?? '不明';
                    }
                    return [
                        'id' => $item->id,
                        'item_number' => $item->item_number,
                        'species_name' => $item->species_name,
                        'quantity' => $item->quantity,
                        'start_price' => $item->start_price,
                        'is_premium' => $item->is_premium,
                        'status' => $item->status,
                        'thumbnail_path' => $item->thumbnail_path,
                        'seller_profile_id' => $item->seller_profile_id,
                        'seller_name' => $sellerName,
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

        // 最低1レーンは必要
        if ($auction->lanes()->count() <= 1) {
            return response()->json([
                'success' => false,
                'message' => '最低1つのレーンが必要です。',
            ], 400);
        }

        // レーンにアイテムが割り当てられている場合
        $itemCount = DB::table('lane_items')->where('lane_id', $laneId)->count();
        if ($itemCount > 0) {
            // アイテムを先に解除
            DB::table('lane_items')->where('lane_id', $laneId)->delete();
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
        $auction = Auction::findOrFail($auctionId);

        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => '開始済みのオークションでは操作できません。',
            ], 400);
        }

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
        $auction = Auction::findOrFail($auctionId);

        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => '開始済みのオークションでは操作できません。',
            ], 400);
        }

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
        $auction = Auction::findOrFail($auctionId);

        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => '開始済みのオークションでは操作できません。',
            ], 400);
        }

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
     * 自動割り当て（Greedy Bin Packing 方式）
     *
     * 未割当の生体を出品者グループ単位で均等にレーンに分配する。
     * - 出品者ごとにグループ化 → グループサイズ降順でソート
     * - 各グループを「現在最も生体が少ないレーン」に割り当て（Greedy）
     * - 各レーン内の出品者グループ順序をランダムにシャッフル
     * - 既存割り当ての末尾に追加（既存は一切変更しない）
     */
    public function autoAssign($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => 'オークションが開始済みのため、自動割り当てできません。',
            ], 400);
        }

        $lanes = $auction->lanes()->orderBy('lane_number')->get();

        if ($lanes->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'レーンが存在しません。先にレーンを作成してください。',
            ], 400);
        }

        // Step 1: 未割当生体を取得
        $laneIds = $lanes->pluck('id');
        $assignedItemIds = DB::table('lane_items')
            ->whereIn('lane_id', $laneIds)
            ->pluck('item_id')
            ->toArray();

        $unassignedItems = Item::where('auction_id', $auctionId)
            ->where('status', 'registered')
            ->whereNotIn('id', $assignedItemIds)
            ->orderBy('item_number')
            ->get();

        if ($unassignedItems->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => '未割当の生体がありません。',
            ], 422);
        }

        // 匿名出品は通常生体と分離し、レーン末尾にランダム配置する
        $anonymousItems = $unassignedItems->where('is_anonymous', true)->values();
        $normalItems = $unassignedItems->where('is_anonymous', false)->values();

        // Step 2: 通常生体を出品者ごとにグループ化（seller_profile_id = NULL は 0 として扱う）
        $groups = $normalItems->groupBy(fn($item) => $item->seller_profile_id ?? 0);

        // Step 3: グループサイズ降順ソート（大きいグループから処理）
        $sortedGroups = $groups->sortByDesc(fn($group) => $group->count())->values();

        // Step 4: 各レーンの現在の生体数を初期値に設定
        $laneCounts = [];
        foreach ($lanes as $lane) {
            $laneCounts[$lane->id] = DB::table('lane_items')->where('lane_id', $lane->id)->count();
        }

        // Greedy Bin Packing: 各グループを「最も空いているレーン」に割り当て
        $laneAssignments = [];
        foreach ($lanes as $lane) {
            $laneAssignments[$lane->id] = collect();
        }

        foreach ($sortedGroups as $group) {
            // 現在最も生体数が少ないレーンを選択（同数の場合はレーン番号が小さい方）
            $targetLaneId = null;
            $minCount = PHP_INT_MAX;
            foreach ($laneCounts as $laneId => $count) {
                if ($count < $minCount) {
                    $minCount = $count;
                    $targetLaneId = $laneId;
                }
            }

            $laneAssignments[$targetLaneId] = $laneAssignments[$targetLaneId]->merge($group);
            $laneCounts[$targetLaneId] += $group->count();
        }

        // Step 5: 各レーン内の出品者グループをシャッフル（グループ単位でランダム化）
        foreach ($laneAssignments as $laneId => $items) {
            if ($items->isEmpty()) {
                continue;
            }
            // 出品者グループに再分割してシャッフル後にフラット化
            $shuffledGroups = $items
                ->groupBy(fn($item) => $item->seller_profile_id ?? 0)
                ->values()
                ->shuffle();
            $laneAssignments[$laneId] = $shuffledGroups->flatten(1);
        }

        // Step 5.5: 匿名出品をレーン末尾にランダム配置
        // 通常生体を全て配置し終えた後、匿名生体を「個体単位で」シャッフルし、
        // 最も空いているレーンへ1個ずつ均等に追加する（出品者グループ化はしない）
        if ($anonymousItems->isNotEmpty()) {
            foreach ($anonymousItems->shuffle() as $anonItem) {
                $targetLaneId = null;
                $minCount = PHP_INT_MAX;
                foreach ($laneCounts as $laneId => $count) {
                    if ($count < $minCount) {
                        $minCount = $count;
                        $targetLaneId = $laneId;
                    }
                }
                $laneAssignments[$targetLaneId] = $laneAssignments[$targetLaneId]->push($anonItem);
                $laneCounts[$targetLaneId]++;
            }
        }

        // Step 6: lane_items に挿入（既存アイテムの後ろに追加）
        $totalAssigned = 0;
        $laneStats = [];

        DB::transaction(function () use ($laneAssignments, $lanes, &$totalAssigned, &$laneStats) {
            foreach ($laneAssignments as $laneId => $items) {
                if ($items->isEmpty()) {
                    $lane = $lanes->find($laneId);
                    $laneStats[] = [
                        'lane_id' => $laneId,
                        'lane_number' => $lane?->lane_number,
                        'added_count' => 0,
                        'total_count' => DB::table('lane_items')->where('lane_id', $laneId)->count(),
                    ];
                    continue;
                }

                // 現在の最大 sequence_order を取得（追加後の末尾から採番）
                $lastOrder = DB::table('lane_items')
                    ->where('lane_id', $laneId)
                    ->max('sequence_order') ?? 0;

                $position = $lastOrder + 1;
                $insertData = [];

                foreach ($items as $item) {
                    $insertData[] = [
                        'lane_id' => $laneId,
                        'item_id' => $item->id,
                        'sequence_order' => $position++,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }

                try {
                    DB::table('lane_items')->insert($insertData);
                    $addedCount = count($insertData);
                } catch (\Illuminate\Database\QueryException $e) {
                    // UNIQUE制約違反（二重クリック等）は個別挿入にフォールバック
                    if ($e->errorInfo[1] !== 1062) {
                        throw $e;
                    }
                    $addedCount = 0;
                    $pos = $lastOrder + 1;
                    foreach ($items as $item) {
                        try {
                            DB::table('lane_items')->insert([
                                'lane_id' => $laneId,
                                'item_id' => $item->id,
                                'sequence_order' => $pos++,
                                'created_at' => now(),
                                'updated_at' => now(),
                            ]);
                            $addedCount++;
                        } catch (\Illuminate\Database\QueryException $inner) {
                            if ($inner->errorInfo[1] !== 1062) {
                                throw $inner;
                            }
                        }
                    }
                }

                $totalAssigned += $addedCount;

                $lane = $lanes->find($laneId);
                $laneStats[] = [
                    'lane_id' => $laneId,
                    'lane_number' => $lane?->lane_number,
                    'added_count' => $addedCount,
                    'total_count' => $lastOrder + $addedCount,
                ];
            }
        });

        return response()->json([
            'success' => true,
            'message' => $totalAssigned . '件の生体を' . $lanes->count() . 'レーンに割り当てました。',
            'data' => [
                'assigned_count' => $totalAssigned,
                'lane_summary' => $laneStats,
            ],
        ]);
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
