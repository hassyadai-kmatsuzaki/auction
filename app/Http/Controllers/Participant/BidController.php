<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Services\BidService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class BidController extends Controller
{
    protected BidService $bidService;

    public function __construct(BidService $bidService)
    {
        $this->bidService = $bidService;
    }

    /**
     * 入札ON/OFF切り替え
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function toggle(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'item_id' => 'required|integer|exists:items,id',
            'is_active' => 'required|boolean',
        ], [
            'item_id.required' => '商品IDは必須です。',
            'item_id.exists' => '指定された商品は存在しません。',
            'is_active.required' => '入札状態は必須です。',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $item = Item::findOrFail($request->item_id);
        $userId = Auth::id();
        $ipAddress = $request->ip();
        $userAgent = $request->userAgent();

        $result = $this->bidService->toggle(
            $item,
            $userId,
            $request->is_active,
            $ipAddress,
            $userAgent
        );

        $statusCode = $result['success'] ? 200 : 400;

        return response()->json($result, $statusCode);
    }

    /**
     * 自分のアクティブな入札一覧を取得
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function myActive()
    {
        $userId = Auth::id();
        $activeBids = $this->bidService->getActiveParticipations($userId);

        return response()->json([
            'success' => true,
            'data' => [
                'active_bids' => $activeBids,
            ],
        ]);
    }
}
