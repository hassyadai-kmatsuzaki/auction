<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * フロントからの行動計測（track）受け口。
 *
 * 計測は「見えない副作用」なので、記録可否に関わらず常に 204 を返し
 * フロントの体験を一切阻害しない（ActivityLogger 側で失敗も握る）。
 *
 * 対応イベント:
 *   - daily_access … その日最初のアクセス（1ユーザー1日1行）
 *   - venue_enter  … 「会場へ」ボタン（1ユーザー1オークション1行、ライブ中も可）
 *   - item_view    … 生体詳細閲覧（開始前のみ・1ユーザー1日×item 1行）
 */
class TrackController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'event'      => 'required|string|in:daily_access,venue_enter,item_view',
            'auction_id' => 'nullable|integer',
            'item_id'    => 'nullable|integer',
        ]);

        $userId = Auth::id();

        switch ($data['event']) {
            case 'daily_access':
                ActivityLogger::dailyAccess($userId);
                break;

            case 'venue_enter':
                if (!empty($data['auction_id'])) {
                    ActivityLogger::venueEnter((int) $data['auction_id'], $userId);
                }
                break;

            case 'item_view':
                if (!empty($data['item_id'])) {
                    ActivityLogger::itemView((int) $data['item_id'], $userId);
                }
                break;
        }

        return response()->json(['success' => true], 204);
    }
}
