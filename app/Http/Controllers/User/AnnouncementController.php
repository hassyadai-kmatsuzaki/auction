<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\Request;

class AnnouncementController extends Controller
{
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
        
        return response()->json([
            'success' => true,
            'data' => [
                'announcements' => $announcements->items(),
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
}
