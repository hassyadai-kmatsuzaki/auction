<?php

namespace App\Http\Controllers\Participant;

use App\Actions\Bid\SetBidLimitAction;
use App\Http\Controllers\Controller;
use App\Models\BidLimitPrice;
use App\Models\Item;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class BidLimitController extends Controller
{
    public function __construct(
        private readonly SetBidLimitAction $setLimitAction,
    ) {}

    /**
     * 指値（上限価格）を設定・更新
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'item_id'     => 'required|integer|exists:items,id',
            'limit_price' => 'required|numeric|min:1',
        ], [
            'item_id.exists'   => '指定された商品は存在しません。',
            'limit_price.min'  => '上限価格は1円以上を指定してください。',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $item   = Item::with('auction')->findOrFail($request->item_id);
        $result = $this->setLimitAction->execute($item, Auth::id(), (float) $request->limit_price);

        return $result->toResponse();
    }

    /**
     * 指値を解除
     */
    public function destroy(int $itemId): JsonResponse
    {
        $item   = Item::findOrFail($itemId);
        $result = $this->setLimitAction->remove($item, Auth::id());

        return $result->toResponse();
    }

    /**
     * 指値の現在設定を一括取得
     * GET /api/participant/bid-limits?item_ids[]=101&item_ids[]=102
     */
    public function index(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'item_ids'   => 'required|array|max:50',
            'item_ids.*' => 'integer|exists:items,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $userId = Auth::id();
        $limits = BidLimitPrice::where('user_id', $userId)
            ->whereIn('item_id', $request->item_ids)
            ->get()
            ->keyBy('item_id');

        $result = [];
        foreach ($request->item_ids as $itemId) {
            $limit = $limits->get($itemId);
            $result[$itemId] = $limit ? [
                'limit_price'  => $limit->limit_price,
                'is_triggered' => $limit->is_triggered,
            ] : null;
        }

        return response()->json(['success' => true, 'data' => ['limits' => $result]]);
    }

    /**
     * 単一商品の指値と共にクイック入力の選択肢を取得
     */
    public function show(int $itemId): JsonResponse
    {
        $item  = Item::findOrFail($itemId);
        $limit = BidLimitPrice::forItem($itemId)->forUser(Auth::id())->first();

        $base = (int) floor($item->status === 'live' ? $item->current_price : $item->start_price);

        return response()->json(['success' => true, 'data' => [
            'item_id'       => $item->id,
            'limit_price'   => $limit ? (int) floor($limit->limit_price) : null,
            'is_triggered'  => $limit?->is_triggered ?? false,
            'quick_options' => [
                'base_price' => $base,
                'x1_5'       => (int) floor($base * 1.5),
                'x2'         => (int) floor($base * 2),
                'x2_5'       => (int) floor($base * 2.5),
                'x3'         => (int) floor($base * 3),
            ],
        ]]);
    }
}
