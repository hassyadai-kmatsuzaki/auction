<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Auction\UpdateAuctionStatusAction;
use App\Actions\Auction\UpdateLaneCountAction;
use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class AuctionController extends Controller
{
    public function __construct(
        private readonly UpdateAuctionStatusAction $updateStatusAction,
        private readonly UpdateLaneCountAction     $updateLaneCountAction,
    ) {}

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
            'lane_count' => 1, // 初期値1、レーン割り当て画面で管理
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

        $auction->update([
            'title' => $request->title,
            'event_date' => $request->event_date,
            'start_time' => $request->start_time,
            'description' => $request->description,
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

        // レーン数はレーン割り当て画面で管理（ここでは変更しない）

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

        if (!$auction->canDelete()) {
            return response()->json([
                'success' => false,
                'message' => '開催中のオークションは削除できません。',
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
    /** ステータス変更 */
    public function updateStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:preparing,scheduled,live,finished,cancelled',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $auction = Auction::findOrFail($id);
        return $this->updateStatusAction->execute($auction, $request->status)->toResponse();
    }

    /** レーン数更新 */
    public function updateLaneCount(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'lane_count' => 'required|integer|between:1,10',
        ], [
            'lane_count.required' => 'レーン数は必須です。',
            'lane_count.between'  => 'レーン数は1〜10の範囲で指定してください。',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $auction = Auction::findOrFail($id);
        return $this->updateLaneCountAction->execute($auction, (int) $request->lane_count)->toResponse();
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
