<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnnouncementController extends Controller
{
    /** ベルの未読バッジの対象期間（従来の「7日以内」表示に合わせる） */
    private const UNREAD_BADGE_DAYS = 7;

    /**
     * ユーザー向けお知らせ一覧取得
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 20);
        $user = $request->user();
        
        $announcements = Announcement::visibleTo($user)->paginate($perPage);

        // 既読管理（F-092）: 一覧の各件に is_read を付け、ベル用に「7日以内の未読数」を返す
        $readIds = DB::table('announcement_reads')
            ->where('user_id', $user->id)
            ->whereIn('announcement_id', collect($announcements->items())->pluck('id'))
            ->pluck('announcement_id')
            ->all();
        $items = collect($announcements->items())
            ->map(fn ($a) => $a->setAttribute('is_read', in_array($a->id, $readIds, true)))
            ->all();

        return response()->json([
            'success' => true,
            'data' => [
                'announcements' => $items,
                'unread_count' => $this->unreadCount($user),
                'pagination' => [
                    'total' => $announcements->total(),
                    'per_page' => $announcements->perPage(),
                    'current_page' => $announcements->currentPage(),
                    'last_page' => $announcements->lastPage(),
                ],
            ],
        ]);
    }

    /**
     * お知らせ詳細取得
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $announcement = Announcement::whereNull('deleted_at')->findOrFail($id);
        
        if (!$announcement->isVisibleToUser($user)) {
            return response()->json([
                'success' => false,
                'message' => 'このお知らせは表示できません。',
            ], 403);
        }

        if (config('features.announcement_read')) {
            $this->markRead($user->id, [$announcement->id]);
        }
        
        return response()->json([
            'success' => true,
            'data' => [
                'announcement' => [
                    'id' => $announcement->id,
                    'title' => $announcement->title,
                    'content' => $announcement->content,
                    'is_important' => $announcement->is_important,
                    'published_at' => $announcement->published_at,
                ],
            ],
        ]);
    }

    /**
     * 既読にする（ベルを開いたときに表示中のお知らせをまとめて既読化）。見えないお知らせは無視する
     */
    public function markAsRead(Request $request)
    {
        abort_unless(config('features.announcement_read'), 404);

        $validated = $request->validate([
            'ids' => 'required|array|max:100',
            'ids.*' => 'integer',
        ]);
        $user = $request->user();

        $visibleIds = Announcement::visibleTo($user)->whereIn('id', $validated['ids'])->pluck('id')->all();
        $this->markRead($user->id, $visibleIds);

        return response()->json([
            'success' => true,
            'data' => ['unread_count' => $this->unreadCount($user)],
        ]);
    }

    private function markRead(int $userId, array $announcementIds): void
    {
        if (!$announcementIds) {
            return;
        }
        $now = now();
        DB::table('announcement_reads')->insertOrIgnore(array_map(fn ($id) => [
            'announcement_id' => $id,
            'user_id' => $userId,
            'read_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ], $announcementIds));
    }

    private function unreadCount($user): int
    {
        return Announcement::visibleTo($user)
            ->where('published_at', '>=', now()->subDays(self::UNREAD_BADGE_DAYS))
            ->whereNotExists(fn ($q) => $q->select(DB::raw(1))
                ->from('announcement_reads')
                ->whereColumn('announcement_reads.announcement_id', 'announcements.id')
                ->where('announcement_reads.user_id', $user->id))
            ->count();
    }
}
