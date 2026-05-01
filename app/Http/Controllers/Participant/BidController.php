<?php

namespace App\Http\Controllers\Participant;

use App\Actions\Bid\JoinBidAction;
use App\Actions\Bid\LeaveBidAction;
use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Services\BidService;
use App\Services\TestModeService;
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
        private readonly TestModeService $testMode,
    ) {}

    /**
     * 入札参加（単方向入札仕様）
     *
     * 旧仕様の「ON/OFFトグル」は廃止。`is_active=false` のリクエストは
     * 互換性のためエンドポイント自体は残すが、サーバーで一律 403 で拒否する。
     * 自分からの離脱動線は存在しない（auto-left は CountdownService 経由のみ）。
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

        // 単方向入札: 離脱リクエスト（is_active=false）は受け付けない
        if (!$request->boolean('is_active')) {
            return response()->json([
                'success' => false,
                'message' => '入札の取り消しはできません。',
            ], 403);
        }

        $itemQuery = Item::query()->where('id', $request->item_id);
        $this->testMode->applyToItemQuery($itemQuery);
        $item = $itemQuery->first();
        if (!$item) {
            return response()->json(['success' => false, 'message' => '指定された商品は存在しません。'], 404);
        }
        $userId    = Auth::id();
        $ip        = $request->ip();
        $userAgent = $request->userAgent();

        $result = $this->joinBidAction->execute($item, $userId, $ip, $userAgent);

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
