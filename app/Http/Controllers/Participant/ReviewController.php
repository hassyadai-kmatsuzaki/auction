<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use App\Models\UserReview;
use App\Models\WonItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    /**
     * 自分が受けた評価一覧
     */
    public function received(Request $request): JsonResponse
    {
        $reviews = UserReview::where('reviewee_id', $request->user()->id)
            ->with(['reviewer:id,name', 'wonItem.item:id,species_name,item_number'])
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json(['success' => true, 'data' => $reviews]);
    }

    /**
     * 取引に対する評価を投稿
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'won_item_id' => 'required|integer|exists:won_items,id',
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        $wonItem = WonItem::with('item.seller')->findOrFail($request->won_item_id);

        // 買い手か出品者かを判定
        $isBuyer = $wonItem->winner_id === $user->id;
        $isSeller = $wonItem->item && $wonItem->item->seller && $wonItem->item->seller->id === $user->id;

        if (!$isBuyer && !$isSeller) {
            return response()->json([
                'success' => false,
                'message' => 'この取引の評価権限がありません',
            ], 403);
        }

        $role = $isBuyer ? 'buyer' : 'seller';

        // 既に評価済みかチェック
        $exists = UserReview::where('won_item_id', $request->won_item_id)
            ->where('role', $role)
            ->exists();

        if ($exists) {
            return response()->json([
                'success' => false,
                'message' => 'この取引は既に評価済みです',
            ], 422);
        }

        // 取引完了後のみ評価可能
        if ($wonItem->payment_status !== 'paid') {
            return response()->json([
                'success' => false,
                'message' => '入金確認後に評価できます',
            ], 422);
        }

        $revieweeId = $isBuyer
            ? $wonItem->item->seller?->id
            : $wonItem->winner_id;

        // 評価対象ユーザーが存在しない場合
        if (!$revieweeId || !\App\Models\User::where('id', $revieweeId)->exists()) {
            return response()->json([
                'success' => false,
                'message' => '評価対象のユーザーアカウントが存在しません',
            ], 422);
        }

        $review = UserReview::create([
            'reviewer_id' => $user->id,
            'reviewee_id' => $revieweeId,
            'won_item_id' => $request->won_item_id,
            'role' => $role,
            'rating' => $request->rating,
            'comment' => $request->comment,
        ]);

        // 信頼度スコアを再計算
        $this->recalculateTrustScore($revieweeId);

        return response()->json([
            'success' => true,
            'data' => $review->load('reviewer:id,name'),
        ], 201);
    }

    /**
     * ユーザーの評価サマリーを取得
     */
    public function summary(int $userId): JsonResponse
    {
        $stats = UserReview::where('reviewee_id', $userId)
            ->selectRaw('COUNT(*) as total, AVG(rating) as average,
                SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as positive,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as neutral,
                SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as negative')
            ->first();

        $recent = UserReview::where('reviewee_id', $userId)
            ->with(['reviewer:id,name'])
            ->orderByDesc('created_at')
            ->limit(5)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'total' => (int) $stats->total,
                'average' => $stats->average ? round($stats->average, 1) : null,
                'positive' => (int) $stats->positive,
                'neutral' => (int) $stats->neutral,
                'negative' => (int) $stats->negative,
                'recent_reviews' => $recent,
            ],
        ]);
    }

    /**
     * 信頼度スコアを再計算
     */
    private function recalculateTrustScore(int $userId): void
    {
        $stats = UserReview::where('reviewee_id', $userId)
            ->selectRaw('COUNT(*) as total, AVG(rating) as average')
            ->first();

        $score = $stats->total > 0 ? round($stats->average / 5, 2) : 0;

        \App\Models\User::where('id', $userId)->update([
            'trust_score' => $score,
            'review_count' => $stats->total,
        ]);
    }
}
