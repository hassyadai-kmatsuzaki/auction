<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class AuctionController extends Controller
{
    /**
     * オークション一覧取得
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 20);
        
        $filters = [
            'status' => $request->input('status', 'all'),
            'date_from' => $request->input('date_from'),
            'date_to' => $request->input('date_to'),
            'sort_by' => $request->input('sort_by', 'event_date'),
            'sort_order' => $request->input('sort_order', 'desc'),
        ];
        
        $auctions = Auction::with(['creator:id,name'])
            ->withItemsCount()
            ->forAdmin($filters)
            ->paginate($perPage);
        
        return response()->json([
            'success' => true,
            'data' => [
                'auctions' => $auctions->items(),
                'pagination' => [
                    'total' => $auctions->total(),
                    'per_page' => $auctions->perPage(),
                    'current_page' => $auctions->currentPage(),
                    'last_page' => $auctions->lastPage(),
                ],
            ],
        ]);
    }

    /**
     * オークション詳細取得
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show($id)
    {
        $auction = Auction::with(['creator:id,name'])
            ->withItemsCount()
            ->findOrFail($id);
        
        return response()->json([
            'success' => true,
            'data' => [
                'auction' => $auction,
            ],
        ]);
    }

    /**
     * オークション作成
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'event_date' => 'required|date|after_or_equal:today',
            'start_time' => 'required|date_format:H:i',
            'description' => 'nullable|string',
            'lane_count' => 'required|integer|between:1,10',
            'default_bid_increment' => 'required|numeric|min:1',
            'countdown_seconds' => 'required|integer|between:1,60',
            'deposit_required' => 'boolean',
            'upload_deadline' => 'nullable|date',
            'payment_deadline_hours' => 'required|integer|min:1',
            'shipping_deadline_hours' => 'required|integer|min:1',
        ], [
            'title.required' => 'オークション名は必須です。',
            'title.max' => 'オークション名は255文字以内で入力してください。',
            'event_date.required' => '開催日は必須です。',
            'event_date.after_or_equal' => '開催日は本日以降を指定してください。',
            'start_time.required' => '開始時刻は必須です。',
            'start_time.date_format' => '開始時刻の形式が不正です。',
            'lane_count.required' => 'レーン数は必須です。',
            'lane_count.between' => 'レーン数は1〜10の範囲で指定してください。',
            'default_bid_increment.required' => 'デフォルト入札単位は必須です。',
            'default_bid_increment.min' => 'デフォルト入札単位は1円以上を指定してください。',
            'countdown_seconds.required' => 'カウントダウン秒数は必須です。',
            'countdown_seconds.between' => 'カウントダウン秒数は1〜60秒の範囲で指定してください。',
            'payment_deadline_hours.required' => '入金期限は必須です。',
            'payment_deadline_hours.min' => '入金期限は1時間以上を指定してください。',
            'shipping_deadline_hours.required' => '発送期限は必須です。',
            'shipping_deadline_hours.min' => '発送期限は1時間以上を指定してください。',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        // アップロード期限が開催日時より前かチェック
        if ($request->upload_deadline) {
            $eventDateTime = \Carbon\Carbon::parse($request->event_date . ' ' . $request->start_time);
            $uploadDeadline = \Carbon\Carbon::parse($request->upload_deadline);
            
            if ($uploadDeadline >= $eventDateTime) {
                return response()->json([
                    'success' => false,
                    'errors' => [
                        'upload_deadline' => ['アップロード期限は開催日時より前に設定してください。']
                    ],
                ], 422);
            }
        }

        $auction = Auction::create([
            'title' => $request->title,
            'event_date' => $request->event_date,
            'start_time' => $request->start_time,
            'description' => $request->description,
            'lane_count' => $request->lane_count,
            'default_bid_increment' => $request->default_bid_increment,
            'countdown_seconds' => $request->countdown_seconds,
            'deposit_required' => $request->boolean('deposit_required', false),
            'upload_deadline' => $request->upload_deadline,
            'payment_deadline_hours' => $request->payment_deadline_hours,
            'shipping_deadline_hours' => $request->shipping_deadline_hours,
            'status' => 'preparing',
            'created_by' => Auth::id(),
            // カスタム設定
            'use_custom_settings' => $request->boolean('use_custom_settings', false),
            'custom_auction_settings' => $request->input('custom_auction_settings'),
            'custom_fee_settings' => $request->input('custom_fee_settings'),
            'custom_shipping_settings' => $request->input('custom_shipping_settings'),
        ]);

        $auction->load(['creator:id,name']);

        return response()->json([
            'success' => true,
            'message' => 'オークションを作成しました。',
            'data' => [
                'auction' => $auction,
            ],
        ], 201);
    }

    /**
     * オークション更新
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        $auction = Auction::findOrFail($id);

        // 編集可能かチェック
        if (!$auction->canEdit()) {
            return response()->json([
                'success' => false,
                'message' => 'このオークションは編集できません。',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'event_date' => 'required|date|after_or_equal:today',
            'start_time' => 'required|date_format:H:i',
            'description' => 'nullable|string',
            'lane_count' => 'required|integer|between:1,10',
            'default_bid_increment' => 'required|numeric|min:1',
            'countdown_seconds' => 'required|integer|between:1,60',
            'deposit_required' => 'boolean',
            'upload_deadline' => 'nullable|date',
            'payment_deadline_hours' => 'required|integer|min:1',
            'shipping_deadline_hours' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        // アップロード期限が開催日時より前かチェック
        if ($request->upload_deadline) {
            $eventDateTime = \Carbon\Carbon::parse($request->event_date . ' ' . $request->start_time);
            $uploadDeadline = \Carbon\Carbon::parse($request->upload_deadline);
            
            if ($uploadDeadline >= $eventDateTime) {
                return response()->json([
                    'success' => false,
                    'errors' => [
                        'upload_deadline' => ['アップロード期限は開催日時より前に設定してください。']
                    ],
                ], 422);
            }
        }

        $oldLaneCount = $auction->lane_count;
        $newLaneCount = $request->lane_count;

        $auction->update([
            'title' => $request->title,
            'event_date' => $request->event_date,
            'start_time' => $request->start_time,
            'description' => $request->description,
            'lane_count' => $request->lane_count,
            'default_bid_increment' => $request->default_bid_increment,
            'countdown_seconds' => $request->countdown_seconds,
            'deposit_required' => $request->boolean('deposit_required', false),
            'upload_deadline' => $request->upload_deadline,
            'payment_deadline_hours' => $request->payment_deadline_hours,
            'shipping_deadline_hours' => $request->shipping_deadline_hours,
            // カスタム設定
            'use_custom_settings' => $request->boolean('use_custom_settings', false),
            'custom_auction_settings' => $request->input('custom_auction_settings'),
            'custom_fee_settings' => $request->input('custom_fee_settings'),
            'custom_shipping_settings' => $request->input('custom_shipping_settings'),
        ]);

        // レーン数が増えた場合、新しいレーンを作成
        if ($newLaneCount > $oldLaneCount) {
            for ($i = $oldLaneCount + 1; $i <= $newLaneCount; $i++) {
                $auction->lanes()->firstOrCreate(
                    ['lane_number' => $i],
                    ['status' => 'waiting']
                );
            }
        }

        $auction->load(['creator:id,name']);

        return response()->json([
            'success' => true,
            'message' => 'オークションを更新しました。',
            'data' => [
                'auction' => $auction,
            ],
        ]);
    }

    /**
     * オークション削除
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy($id)
    {
        $auction = Auction::findOrFail($id);

        // 削除可能かチェック
        if (!$auction->canDelete()) {
            $message = '商品が登録されているため削除できません。';
            if (!in_array($auction->status, ['preparing', 'scheduled'])) {
                $message = 'このオークションは削除できません。';
            }
            
            return response()->json([
                'success' => false,
                'message' => $message,
            ], 403);
        }

        $auction->delete();

        return response()->json([
            'success' => true,
            'message' => 'オークションを削除しました。',
        ]);
    }

    /**
     * オークションのステータス更新
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateStatus(Request $request, $id)
    {
        $auction = Auction::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:preparing,scheduled,live,finished,cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $newStatus = $request->status;
        $oldStatus = $auction->status;
        $message = '';

        // 同じステータスの場合は何もしない
        if ($newStatus === $oldStatus) {
            return response()->json([
                'success' => true,
                'message' => 'ステータスは既に「' . $this->getStatusLabel($newStatus) . '」です。',
                'data' => [
                    'auction' => $auction->load(['creator:id,name']),
                ],
            ]);
        }

        switch ($newStatus) {
            case 'preparing':
                $auction->status = 'preparing';
                $auction->save();
                $message = 'ステータスを「準備中」に変更しました。';
                break;

            case 'scheduled':
                $auction->status = 'scheduled';
                $auction->save();
                $message = 'ステータスを「予定（出品受付中）」に変更しました。';

                // 新規オークション通知（scheduled になった時のみ送信）
                if ($oldStatus !== 'scheduled') {
                    try {
                        $notificationService = app(NotificationService::class);
                        $sentCount = $notificationService->sendNewAuctionNotification($auction);
                        Log::info("新規オークション通知送信: {$sentCount}件", ['auction_id' => $auction->id]);
                    } catch (\Exception $e) {
                        Log::warning('新規オークション通知でエラー', ['error' => $e->getMessage()]);
                    }
                }
                break;

            case 'live':
                if (!$auction->start()) {
                    return response()->json([
                        'success' => false,
                        'message' => 'オークションを開始できません。承認済みの生体を1件以上登録してください。',
                    ], 400);
                }
                $message = 'オークションを開始しました。';
                break;

            case 'finished':
                if (!$auction->finish()) {
                    return response()->json([
                        'success' => false,
                        'message' => 'オークションを終了できません。',
                    ], 400);
                }
                $message = 'オークションを終了しました。';
                break;

            case 'cancelled':
                if (!$auction->cancel()) {
                    return response()->json([
                        'success' => false,
                        'message' => 'オークションをキャンセルできません。',
                    ], 400);
                }
                $message = 'オークションをキャンセルしました。';
                break;
        }

        $auction->load(['creator:id,name']);

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => [
                'auction' => $auction,
            ],
        ]);
    }

    /**
     * ステータスラベルを取得
     */
    private function getStatusLabel($status): string
    {
        $labels = [
            'preparing' => '準備中',
            'scheduled' => '予定（出品受付中）',
            'live' => '開催中',
            'finished' => '終了',
            'cancelled' => 'キャンセル',
        ];
        return $labels[$status] ?? $status;
    }

    /**
     * レーン数を更新
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateLaneCount(Request $request, $id)
    {
        $auction = Auction::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'lane_count' => 'required|integer|between:1,10',
        ], [
            'lane_count.required' => 'レーン数は必須です。',
            'lane_count.between' => 'レーン数は1〜10の範囲で指定してください。',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        // オークションが終了済みの場合は変更不可
        if (in_array($auction->status, ['finished', 'cancelled'])) {
            return response()->json([
                'success' => false,
                'message' => '終了済みまたはキャンセル済みのオークションは変更できません。',
            ], 400);
        }

        // ライブ中の場合も変更不可
        if ($auction->status === 'live') {
            return response()->json([
                'success' => false,
                'message' => '開催中のオークションのレーン数は変更できません。',
            ], 400);
        }

        $oldLaneCount = $auction->lane_count;
        $newLaneCount = $request->lane_count;

        // レーン数を減らす場合: 削除対象レーンのアイテムを解除してからレーンを削除
        if ($newLaneCount < $oldLaneCount) {
            $lanesToRemove = $auction->lanes()
                ->where('lane_number', '>', $newLaneCount)
                ->pluck('id');

            if ($lanesToRemove->isNotEmpty()) {
                // 削除対象レーンに割り当てられたアイテムを解除
                \Illuminate\Support\Facades\DB::table('lane_items')
                    ->whereIn('lane_id', $lanesToRemove)
                    ->delete();

                // レーンを削除
                $auction->lanes()
                    ->whereIn('id', $lanesToRemove)
                    ->delete();
            }
        }

        $auction->update(['lane_count' => $newLaneCount]);

        // レーン数が増えた場合、新しいレーンを作成
        if ($newLaneCount > $oldLaneCount) {
            for ($i = $oldLaneCount + 1; $i <= $newLaneCount; $i++) {
                $auction->lanes()->firstOrCreate(
                    ['lane_number' => $i],
                    ['status' => 'waiting']
                );
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'レーン数を更新しました。',
            'data' => [
                'auction_id' => $auction->id,
                'lane_count' => $newLaneCount,
            ],
        ]);
    }

    /**
     * 生体管理用オークション一覧取得（アイテム統計付き）
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function itemManagementList(Request $request)
    {
        $auctions = Auction::whereIn('status', ['preparing', 'scheduled', 'live'])
            ->orderBy('event_date', 'asc')
            ->get();

        $result = $auctions->map(function ($auction) {
            // アイテム統計を取得
            $items = $auction->items();
            $totalItems = $items->count();
            $pendingItems = $items->clone()->where('status', 'pending')->count();
            $registeredItems = $items->clone()->where('status', 'registered')->count();

            // レーン割り当て済みアイテム数
            $assignedItems = $auction->lanes()
                ->withCount('items')
                ->get()
                ->sum('items_count');

            return [
                'id' => $auction->id,
                'title' => $auction->title,
                'event_date' => $auction->event_date->format('Y-m-d'),
                'start_time' => $auction->start_time,
                'status' => $auction->status,
                'lane_count' => $auction->lane_count,
                'statistics' => [
                    'total_items' => $totalItems,
                    'pending_items' => $pendingItems,
                    'registered_items' => $registeredItems,
                    'assigned_items' => $assignedItems,
                    'unassigned_items' => $registeredItems - $assignedItems,
                ],
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'auctions' => $result,
            ],
        ]);
    }
}
