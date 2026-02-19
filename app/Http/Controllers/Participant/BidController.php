<?php

namespace App\Http\Controllers\Participant;

use App\Actions\Bid\JoinBidAction;
use App\Actions\Bid\LeaveBidAction;
use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Services\BidService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class BidController extends Controller
{
    public function __construct(
        private readonly JoinBidAction  $joinBidAction,
        private readonly LeaveBidAction $leaveBidAction,
        // 後方互換性のため旧ServiceもDI（getActiveParticipations等で使用）
        private readonly BidService     $bidService,
    ) {}

    /**
     * 入札ON/OFF切り替え
     */
    public function toggle(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'item_id'   => 'required|integer|exists:items,id',
            'is_active' => 'required|boolean',
        ], [
            'item_id.required' => '商品IDは必須です。',
            'item_id.exists'   => '指定された商品は存在しません。',
            'is_active.required' => '入札状態は必須です。',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $item      = Item::findOrFail($request->item_id);
        $userId    = Auth::id();
        $ip        = $request->ip();
        $userAgent = $request->userAgent();

        $result = $request->boolean('is_active')
            ? $this->joinBidAction->execute($item, $userId, $ip, $userAgent)
            : $this->leaveBidAction->execute($item, $userId, $ip, $userAgent);

        return $result->toResponse();
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
