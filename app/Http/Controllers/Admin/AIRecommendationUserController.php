<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AI\AiDataScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * AIレコメンドの「対象ユーザー」選択肢。
 * 落札実績の多い順に並べ、実績のある人を選べばおすすめが出るようにする（実績の無い人は行動データ不足になりやすい）。
 */
class AIRecommendationUserController extends Controller
{
    private const MAX_USERS = 500;

    /**
     * GET /api/admin/ai/recommendation-users
     */
    public function index(): JsonResponse
    {
        // 実取引の落札件数（テスト開催・除外開催、下支え・テスト会員の落札を除く）
        $wins = AiDataScope::realWonItems(
            DB::table('won_items')->join('items', 'items.id', '=', 'won_items.item_id'),
        )
            ->groupBy('won_items.winner_id')
            ->selectRaw('won_items.winner_id as user_id, COUNT(*) as wins, MAX(won_items.created_at) as last_won_at')
            ->get()
            ->keyBy('user_id');

        $users = User::whereHas('roles', fn ($q) => $q->where('name', 'participant'))
            ->where('is_test', false)
            ->whereNotIn('id', AiDataScope::houseBuyerIds() ?: [0])
            ->get(['id', 'name', 'trade_name', 'email'])
            ->map(function (User $u) use ($wins) {
                $w = $wins->get($u->id);
                return [
                    'id' => $u->id,
                    'name' => (string) ($u->trade_name ?: $u->name),
                    'email' => $u->email,
                    'wins' => (int) ($w->wins ?? 0),
                    'last_won_at' => $w->last_won_at ?? null,
                ];
            })
            ->sort(fn ($a, $b) => [$b['wins'], (string) $b['last_won_at'], $a['id']] <=> [$a['wins'], (string) $a['last_won_at'], $b['id']])
            ->take(self::MAX_USERS)
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'users' => $users,
                'with_wins' => $users->where('wins', '>', 0)->count(),
            ],
        ]);
    }
}
