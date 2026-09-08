<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Exhibit\IssueExhibitCodeAction;
use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\AuctionSellerOrder;
use App\Models\Item;
use App\Models\Lane;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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
                $query->select('items.id', 'item_number', 'exhibit_code', 'species_name', 'quantity', 'start_price', 'is_premium', 'is_anonymous', 'status', 'thumbnail_path', 'seller_profile_id')
                    ->with(['sellerProfile.user'])
                    ->orderBy('lane_items.sequence_order');
            }])
            ->orderBy('lane_number')
            ->get();

        // 未割り当ての生体
        $assignedItemIds = $lanes->flatMap(fn($lane) => $lane->items->pluck('id'))->toArray();
        $unassignedItems = Item::where('auction_id', $auctionId)
            // 審査中(draft)・承認済み(registered) の両方をレーン割り当て対象にする。
            // 審査中でも割り当て可能だが、承認(registered)するまで落札ユーザーには非表示・liveに昇格しない。
            ->whereIn('status', ['draft', 'registered'])
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
                    // 出品者順序の確定状態。null の間はレーン画面が出品者グループ配置モードになる
                    'lane_order_confirmed_at' => $auction->lane_order_confirmed_at?->toIso8601String(),
                    'lane_order_confirmed_by_name' => $auction->laneOrderConfirmer?->name,
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
                                'exhibit_code' => $item->exhibit_code,
                                'species_name' => $item->species_name,
                                'quantity' => $item->quantity,
                                'start_price' => $item->start_price,
                                'is_premium' => $item->is_premium,
                                'is_anonymous' => (bool) $item->is_anonymous,
                                'status' => $item->status,
                                'thumbnail_path' => $item->thumbnail_path,
                                'sequence_order' => $item->pivot->sequence_order,
                                'seller_profile_id' => $item->seller_profile_id,
                                'seller_name' => $sellerName,
                                'seller_code' => $item->sellerProfile?->seller_code,
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
                        'is_anonymous' => (bool) $item->is_anonymous,
                        'status' => $item->status,
                        'thumbnail_path' => $item->thumbnail_path,
                        'seller_profile_id' => $item->seller_profile_id,
                        'seller_name' => $sellerName,
                        'seller_code' => $item->sellerProfile?->seller_code,
                    ];
                }),
                'statistics' => [
                    // 審査中(draft)・承認済み(registered) の両方が割り当て対象。
                    'total_items' => Item::where('auction_id', $auctionId)->whereIn('status', ['draft', 'registered'])->count(),
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
        if ($laneName === null || trim($laneName) === '') {
            $laneName = $this->defaultLaneName($newLaneNumber);
        }

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
     *
     * 出品ID（exhibit_code）はここでは発行しない。並び順を確定させてから
     * `issueExhibitCodes` で一括発行する運用に切り替え済み。
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

        // 生体単位の操作は出品者順序の確定後に限る（未確定の間はグループ単位 moveGroup のみ）
        if ($rejected = $this->rejectUnlessLaneOrderConfirmed($auction)) {
            return $rejected;
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

        // 生体単位の操作は出品者順序の確定後に限る（未確定の間はグループ単位 moveGroup のみ）
        if ($rejected = $this->rejectUnlessLaneOrderConfirmed($auction)) {
            return $rejected;
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

        // 生体単位の操作は出品者順序の確定後に限る（未確定の間はグループ単位 moveGroup のみ）
        if ($rejected = $this->rejectUnlessLaneOrderConfirmed($auction)) {
            return $rejected;
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
     * 未割当の生体を「出品者 × 通常/匿名」のグループ単位で均等にレーンに分配する。
     * - 同じ出品者でも通常出品と匿名出品は別グループ
     * - 通常グループ → 匿名グループの順に、サイズ降順で「現在最も生体が少ないレーン」へ（Greedy）
     * - レーン内は 通常グループ（出品者順序 display_order 順）→ 匿名グループ（同）の順。
     *   つまり匿名グループは各レーンの末尾にまとまる。出品者順序が未設定ならランダム順
     * - グループ内の生体順は seller_display_order → item_number（出品者順序ページの並び）
     * - 既存割り当ての末尾に追加（既存は一切変更しない）
     * - 確定状態（lane_order_confirmed_at）は変更しない。確定前後どちらでも実行できる
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
            // 審査中(draft)・承認済み(registered) の両方を自動割り当て対象にする。
            ->whereIn('status', ['draft', 'registered'])
            ->whereNotIn('id', $assignedItemIds)
            // 出品者順序ページで並べた生体順（seller_display_order）を尊重し、未設定は商品番号順
            ->orderByRaw('seller_display_order IS NULL, seller_display_order, item_number')
            ->get();

        if ($unassignedItems->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => '未割当の生体がありません。',
            ], 422);
        }

        // Step 2: 「出品者 × 通常/匿名」でグループ化（seller_profile_id = NULL は 0 として扱う）
        //   同じ出品者でも通常出品と匿名出品は別グループ。匿名グループは各レーン末尾にまとめる。
        $bySeller = fn($item) => $item->seller_profile_id ?? 0;
        $normalGroups = $unassignedItems->where('is_anonymous', false)->groupBy($bySeller);
        $anonGroups = $unassignedItems->where('is_anonymous', true)->groupBy($bySeller);

        // Step 3: レーン内の並び順を決める出品者ランク。
        //   出品者順序（auction_seller_orders.display_order）があればそれに従い、
        //   未設定ならランダム（従来のシャッフルと同じ挙動）。同一出品者の通常/匿名は同じランク。
        $displayOrders = AuctionSellerOrder::where('auction_id', $auctionId)
            ->pluck('display_order', 'seller_profile_id');
        $sellerIds = $unassignedItems->map($bySeller)->unique()->values();
        $rank = [];
        if ($displayOrders->isEmpty()) {
            foreach ($sellerIds->shuffle()->values() as $i => $sid) {
                $rank[$sid] = $i;
            }
        } else {
            foreach ($sellerIds as $sid) {
                // 出品者順序に載っていない出品者は末尾
                $rank[$sid] = $displayOrders->has($sid) ? (int) $displayOrders[$sid] : PHP_INT_MAX;
            }
        }

        // Step 4: 各レーンの現在の生体数を初期値に設定
        $laneCounts = [];
        $laneGroups = [];
        foreach ($lanes as $lane) {
            $laneCounts[$lane->id] = DB::table('lane_items')->where('lane_id', $lane->id)->count();
            $laneGroups[$lane->id] = ['normal' => [], 'anon' => []];
        }

        // 現在最も生体数が少ないレーンを選ぶ（同数の場合はレーン番号が小さい方）
        $pickEmptiestLane = function () use (&$laneCounts) {
            $targetLaneId = null;
            $minCount = PHP_INT_MAX;
            foreach ($laneCounts as $laneId => $count) {
                if ($count < $minCount) {
                    $minCount = $count;
                    $targetLaneId = $laneId;
                }
            }
            return $targetLaneId;
        };

        // Greedy Bin Packing: 通常グループ → 匿名グループの順に、サイズ降順で「最も空いているレーン」へ
        foreach (['normal' => $normalGroups, 'anon' => $anonGroups] as $kind => $groups) {
            foreach ($groups->sortByDesc(fn($group) => $group->count()) as $sid => $group) {
                $targetLaneId = $pickEmptiestLane();
                $laneGroups[$targetLaneId][$kind][] = ['sid' => $sid, 'items' => $group];
                $laneCounts[$targetLaneId] += $group->count();
            }
        }

        // Step 5: レーン内の順序を決める。
        //   通常グループを出品者ランク順 → 匿名グループを出品者ランク順（匿名は末尾にまとまる）。
        //   グループ内の生体順は Step 1 の取得順（seller_display_order → item_number）をそのまま使う。
        $laneAssignments = [];
        foreach ($laneGroups as $laneId => $kinds) {
            $ordered = collect();
            foreach (['normal', 'anon'] as $kind) {
                $groups = $kinds[$kind];
                usort($groups, fn($a, $b) => [$rank[$a['sid']], $a['sid']] <=> [$rank[$b['sid']], $b['sid']]);
                foreach ($groups as $group) {
                    $ordered = $ordered->concat($group['items']->values()->all());
                }
            }
            $laneAssignments[$laneId] = $ordered;
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
     * 出品者順序を確定する（出品者グループ配置モード → 生体単位モード）。
     *
     * 確定後は assignItem / removeItem / reorderItems（生体単位）が使えるようになり、
     * moveGroup（グループ単位）は拒否される。冪等（既に確定済みなら何もしない）。
     */
    public function confirmLaneOrder($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => '開始済みのオークションでは操作できません。',
            ], 400);
        }

        if ($auction->lane_order_confirmed_at === null) {
            $auction->update([
                'lane_order_confirmed_at' => now(),
                'lane_order_confirmed_by' => Auth::id(),
            ]);
        }
        $auction->refresh()->load('laneOrderConfirmer');

        return response()->json([
            'success' => true,
            'message' => '出品者順序を確定しました。生体単位で並び替えができます。',
            'data' => [
                'lane_order_confirmed_at' => $auction->lane_order_confirmed_at?->toIso8601String(),
                'lane_order_confirmed_by_name' => $auction->laneOrderConfirmer?->name,
            ],
        ]);
    }

    /**
     * 出品者順序の確定を解除する（生体単位モード → 出品者グループ配置モード）。
     *
     * 解除後、レーン内で同じ出品者が離れて並んでいる場合は連続区間ごとに別グループとして扱われる
     * （フロント側で lane_items の並びから導出する。データは変更しない）。
     */
    public function unconfirmLaneOrder($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => '開始済みのオークションでは操作できません。',
            ], 400);
        }

        $auction->update([
            'lane_order_confirmed_at' => null,
            'lane_order_confirmed_by' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => '出品者順序の確定を解除しました。出品者グループ単位で配置できます。',
        ]);
    }

    /**
     * 出品者グループ（同一出品者 × 通常/匿名）をまとめて移動する（確定前のみ）。
     *
     * body:
     *  - item_ids[]     : グループを構成する生体ID。全て同じ出品者・同じ匿名区分で、
     *                     現在位置も揃っていること（全て未割当 or 全て同じレーン）
     *  - target_lane_id : 移動先レーン。null なら未割当に戻す
     *  - before_item_id : 移動先レーン内でこの生体の直前に挿入する。null なら末尾
     *
     * グループ内の生体順は、レーンから動かす場合は現在の並び、未割当から入れる場合は
     * seller_display_order → item_number（出品者順序ページの並び）を使う。
     */
    public function moveGroup(Request $request, $auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => '開始済みのオークションでは操作できません。',
            ], 400);
        }

        if ($auction->lane_order_confirmed_at !== null) {
            return response()->json([
                'success' => false,
                'message' => '出品者順序は確定済みです。グループ単位の移動は「確定を解除」後に行ってください。',
                'code' => 'LANE_ORDER_CONFIRMED',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'item_ids' => 'required|array|min:1',
            'item_ids.*' => 'integer',
            'target_lane_id' => 'nullable|integer',
            'before_item_id' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $itemIds = array_values(array_unique(array_map('intval', $request->item_ids)));
        $beforeItemId = $request->input('before_item_id');
        $targetLaneId = $request->input('target_lane_id');

        $items = Item::where('auction_id', $auctionId)
            ->whereIn('id', $itemIds)
            ->orderByRaw('seller_display_order IS NULL, seller_display_order, item_number')
            ->get();

        if ($items->count() !== count($itemIds)) {
            return response()->json([
                'success' => false,
                'message' => '指定された生体が見つかりません。',
            ], 422);
        }

        $groupKeys = $items->map(fn($item) => ($item->seller_profile_id ?? 0) . ':' . ($item->is_anonymous ? 1 : 0))->unique();
        if ($groupKeys->count() !== 1) {
            return response()->json([
                'success' => false,
                'message' => '同じ出品者・同じ匿名区分の生体だけをまとめて移動できます。',
            ], 422);
        }

        if ($beforeItemId !== null && in_array((int) $beforeItemId, $itemIds, true)) {
            return response()->json([
                'success' => false,
                'message' => '移動するグループ自身の生体は挿入位置に指定できません。',
            ], 422);
        }

        $targetLane = null;
        if ($targetLaneId !== null) {
            $targetLane = Lane::where('auction_id', $auctionId)->where('id', $targetLaneId)->first();
            if (!$targetLane) {
                return response()->json([
                    'success' => false,
                    'message' => '移動先のレーンが見つかりません。',
                ], 404);
            }
        }

        $current = DB::table('lane_items')->whereIn('item_id', $itemIds)->get();
        $sourceLaneIds = $current->pluck('lane_id')->unique();
        if ($sourceLaneIds->count() > 1 || ($current->isNotEmpty() && $current->count() !== count($itemIds))) {
            return response()->json([
                'success' => false,
                'message' => '複数のレーンにまたがる生体はまとめて移動できません。',
            ], 422);
        }
        $sourceLaneId = $sourceLaneIds->first();

        if ($targetLane !== null && $beforeItemId !== null) {
            $beforeInTarget = DB::table('lane_items')
                ->where('lane_id', $targetLane->id)
                ->where('item_id', $beforeItemId)
                ->exists();
            if (!$beforeInTarget) {
                return response()->json([
                    'success' => false,
                    'message' => '挿入位置に指定した生体が移動先レーンにありません。',
                ], 422);
            }
        }

        if ($targetLane === null && $sourceLaneId === null) {
            return response()->json([
                'success' => true,
                'message' => 'すでに未割当です。',
            ]);
        }

        // グループ内の順序: レーンから動かすときは現在の並び、未割当からは seller_display_order → item_number
        if ($sourceLaneId !== null) {
            $seq = $current->pluck('sequence_order', 'item_id');
            $orderedIds = $items->sortBy(fn($item) => $seq[$item->id])->pluck('id')->values()->all();
        } else {
            $orderedIds = $items->pluck('id')->values()->all();
        }

        DB::transaction(function () use ($itemIds, $orderedIds, $sourceLaneId, $targetLane, $beforeItemId) {
            // 1) 元の位置から外す
            if ($sourceLaneId !== null) {
                DB::table('lane_items')->where('lane_id', $sourceLaneId)->lockForUpdate()->get();
                DB::table('lane_items')->whereIn('item_id', $itemIds)->delete();
                $this->resequenceLane($sourceLaneId);
            }

            if ($targetLane === null) {
                return; // 未割当へ戻すだけ
            }

            // 2) 挿入位置を決める
            $maxSequence = DB::table('lane_items')
                ->where('lane_id', $targetLane->id)
                ->max('sequence_order') ?? 0;

            if ($beforeItemId !== null) {
                $before = DB::table('lane_items')
                    ->where('lane_id', $targetLane->id)
                    ->where('item_id', $beforeItemId)
                    ->first();
                $position = $before ? (int) $before->sequence_order : $maxSequence + 1;
                if ($position <= $maxSequence) {
                    DB::table('lane_items')
                        ->where('lane_id', $targetLane->id)
                        ->where('sequence_order', '>=', $position)
                        ->increment('sequence_order', count($orderedIds));
                }
            } else {
                $position = $maxSequence + 1;
            }

            // 3) グループを連続して挿入
            $rows = [];
            foreach ($orderedIds as $offset => $itemId) {
                $rows[] = [
                    'lane_id' => $targetLane->id,
                    'item_id' => $itemId,
                    'sequence_order' => $position + $offset,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
            DB::table('lane_items')->insert($rows);
        });

        return response()->json([
            'success' => true,
            'message' => $targetLane === null
                ? '出品者グループを未割当に戻しました。'
                : '出品者グループを移動しました。',
        ]);
    }

    /**
     * 出品ID（exhibit_code）をオークション全体で一括発行する。
     *
     * 動作:
     *  - lane_items に割当済み × exhibit_code が未発行 の items を対象に IssueExhibitCodeAction を実行
     *  - 発行のみ行い、出品者への通知は自動送信しない。通知は管理画面の「出品者へ通知」
     *    （resendExhibitCodeNotifications）から手動で送信する
     *  - 既発行 item は IssueExhibitCodeAction 側で早期 return されるため再採番されない（冪等）
     *
     * 注意: lane_name 未設定や seller_profile_id null の item は IssueExhibitCodeAction 側で
     * 黙ってスキップされるため、対象から除外せずそのまま渡してよい。
     */
    public function issueExhibitCodes($auctionId, IssueExhibitCodeAction $issueExhibitCode)
    {
        $auction = Auction::findOrFail($auctionId);

        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => '開始済みのオークションでは発行できません。',
            ], 400);
        }

        $laneIds = $auction->lanes()->pluck('id');
        if ($laneIds->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'レーンが存在しません。',
            ], 422);
        }

        $assignedItemIds = DB::table('lane_items')
            ->whereIn('lane_id', $laneIds)
            ->pluck('item_id');

        // キャンセル/進行中/落札済みには出品IDを発行しない。
        // 特に、レーン割当後に出品者がキャンセルした item は lane_items が残るため、
        // ここで status ガードしないと cancelled のまま exhibit_code が振られてしまう。
        $targets = Item::whereIn('id', $assignedItemIds)
            ->whereNotIn('status', ['cancelled', 'live', 'sold'])
            ->whereNull('exhibit_code')
            ->get();

        if ($targets->isEmpty()) {
            return response()->json([
                'success' => true,
                'message' => '未発行の出品IDはありません。',
                'data' => ['issued_count' => 0],
            ]);
        }

        $issuedIds = [];
        DB::transaction(function () use ($targets, $issueExhibitCode, &$issuedIds) {
            foreach ($targets as $item) {
                // silent=true で発行のみ。出品者への通知は自動送信せず、
                // 管理画面の「出品者へ通知」ボタン（resendExhibitCodeNotifications）から手動送信する。
                if ($issueExhibitCode->execute($item, silent: true) !== null) {
                    $issuedIds[] = $item->id;
                }
            }
        });

        return response()->json([
            'success' => true,
            'message' => count($issuedIds) . '件の出品IDを発行しました。出品者への通知は「出品者へ通知」から送信してください。',
            'data' => [
                'issued_count' => count($issuedIds),
            ],
        ]);
    }

    /**
     * 発行済みの出品ID通知を全出品者へ再送する。
     *
     * issueExhibitCodes と違い新規発行は行わず、exhibit_code 発行済みの item を
     * (seller_profile_id, auction_id) 単位で NotifyExhibitCodesJob(force: true) に投入する。
     * force ジョブは line_notification_logs の通知済みフィルタを外すため、
     * 前回と同じ内容のメール / LINE がもう一度届く。
     */
    public function resendExhibitCodeNotifications($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => '開始済みのオークションでは再送できません。',
            ], 400);
        }

        // キャンセル済みは通知対象から外す（発行後にキャンセルされた item が混ざり得るため）
        $pairs = Item::where('auction_id', $auction->id)
            ->whereNotNull('exhibit_code')
            ->whereNotNull('seller_profile_id')
            ->where('status', '!=', 'cancelled')
            ->select('seller_profile_id', 'auction_id')
            ->distinct()
            ->get();

        if ($pairs->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => '発行済みの出品IDがありません。先に出品IDを発行してください。',
            ], 422);
        }

        foreach ($pairs as $pair) {
            \App\Jobs\NotifyExhibitCodesJob::dispatchIfNotPending(
                $pair->seller_profile_id,
                $pair->auction_id,
                force: true,
            );
        }

        return response()->json([
            'success' => true,
            'message' => $pairs->count() . '名の出品者へ出品ID通知の再送を投入しました（約1分後に送信されます）。',
            'data' => [
                'notified_sellers' => $pairs->count(),
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
     * 生体単位の操作（割当・解除・並び替え）は出品者順序の確定後に限る。
     * 未確定の間は出品者グループ単位（moveGroup）でのみ配置を変えられる。
     * 未確定なら 422 レスポンスを返し、確定済みなら null を返す。
     */
    private function rejectUnlessLaneOrderConfirmed(Auction $auction)
    {
        if ($auction->lane_order_confirmed_at !== null) {
            return null;
        }

        return response()->json([
            'success' => false,
            'message' => '出品者順序が未確定のため、生体単位の操作はできません。先に「出品者順序を確定」を押してください。',
            'code' => 'LANE_ORDER_NOT_CONFIRMED',
        ], 422);
    }

    /**
     * 初期レーンを作成（レーンが0個の場合のみ）
     *
     * lane_name は A, B, C, ... の英字を自動採番する（出品ID表示用）。
     * lane_number が 26 を超える場合（運用上はあり得ないが）は AA, AB, ... と桁を増やす。
     */
    private function createInitialLanes(Auction $auction): void
    {
        for ($i = 1; $i <= $auction->lane_count; $i++) {
            Lane::create([
                'auction_id' => $auction->id,
                'lane_number' => $i,
                'lane_name' => $this->defaultLaneName($i),
                'status' => 'waiting',
            ]);
        }
    }

    /**
     * レーン番号からデフォルトの lane_name（A, B, ... Z, AA, AB, ...）を生成する。
     */
    private function defaultLaneName(int $laneNumber): string
    {
        $name = '';
        $n = $laneNumber;
        while ($n > 0) {
            $n--;
            $name = chr(65 + ($n % 26)) . $name;
            $n = intdiv($n, 26);
        }
        return $name;
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
