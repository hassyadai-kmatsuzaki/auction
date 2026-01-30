<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class AnnouncementController extends Controller
{
    /**
     * お知らせ一覧取得
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 20);
        
        $filters = [
            'status' => $request->input('status', 'all'),
            'target_role' => $request->input('target_role', 'all'),
            'is_important' => $request->input('is_important'),
            'search' => $request->input('search'),
            'sort_by' => $request->input('sort_by', 'published_at'),
            'sort_order' => $request->input('sort_order', 'desc'),
        ];
        
        $announcements = Announcement::with(['creator:id,name', 'updater:id,name'])
            ->forAdmin($filters)
            ->paginate($perPage);
        
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
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show($id)
    {
        $announcement = Announcement::with(['creator:id,name', 'updater:id,name'])
            ->whereNull('deleted_at')
            ->findOrFail($id);
        
        return response()->json([
            'success' => true,
            'data' => [
                'announcement' => $announcement,
            ],
        ]);
    }

    /**
     * お知らせ作成
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:200',
            'content' => 'required|string',
            'target_roles' => 'required|array',
            'target_roles.*' => 'in:admin,seller,participant',
            'is_important' => 'boolean',
            'status' => 'required|in:draft,scheduled,published',
            'published_at' => 'required_if:status,scheduled,published|date',
        ], [
            'title.required' => 'タイトルは必須です。',
            'title.max' => 'タイトルは200文字以内で入力してください。',
            'content.required' => '本文は必須です。',
            'target_roles.required' => '対象ユーザーを選択してください。',
            'target_roles.*.in' => '対象ユーザーが不正です。',
            'status.required' => 'ステータスを選択してください。',
            'status.in' => 'ステータスが不正です。',
            'published_at.required_if' => '公開日時を入力してください。',
            'published_at.date' => '公開日時の形式が不正です。',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $announcement = Announcement::create([
            'title' => $request->title,
            'content' => $request->content,
            'target_roles' => $request->target_roles,
            'is_important' => $request->boolean('is_important', false),
            'status' => $request->status,
            'published_at' => $request->published_at,
            'created_by' => Auth::id(),
        ]);

        $announcement->load(['creator:id,name']);

        return response()->json([
            'success' => true,
            'message' => 'お知らせを作成しました。',
            'data' => [
                'announcement' => $announcement,
            ],
        ], 201);
    }

    /**
     * お知らせ更新
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        $announcement = Announcement::whereNull('deleted_at')->findOrFail($id);

        // 公開済みの場合は非表示への変更のみ許可
        if ($announcement->status === 'published') {
            if ($request->status === 'hidden') {
                $announcement->update([
                    'status' => 'hidden',
                    'updated_by' => Auth::id(),
                ]);

                $announcement->load(['creator:id,name', 'updater:id,name']);

                return response()->json([
                    'success' => true,
                    'message' => 'お知らせを非表示にしました。',
                    'data' => [
                        'announcement' => $announcement,
                    ],
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => '公開済みのお知らせは編集できません。非表示にすることのみ可能です。',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:200',
            'content' => 'required|string',
            'target_roles' => 'required|array',
            'target_roles.*' => 'in:admin,seller,participant',
            'is_important' => 'boolean',
            'status' => 'required|in:draft,scheduled,published',
            'published_at' => 'required_if:status,scheduled,published|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $announcement->update([
            'title' => $request->title,
            'content' => $request->content,
            'target_roles' => $request->target_roles,
            'is_important' => $request->boolean('is_important', false),
            'status' => $request->status,
            'published_at' => $request->published_at,
            'updated_by' => Auth::id(),
        ]);

        $announcement->load(['creator:id,name', 'updater:id,name']);

        return response()->json([
            'success' => true,
            'message' => 'お知らせを更新しました。',
            'data' => [
                'announcement' => $announcement,
            ],
        ]);
    }

    /**
     * お知らせ削除（論理削除）
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy($id)
    {
        $announcement = Announcement::whereNull('deleted_at')->findOrFail($id);

        $announcement->update([
            'deleted_at' => now(),
            'deleted_by' => Auth::id(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'お知らせを削除しました。',
        ]);
    }

    /**
     * お知らせの表示/非表示切り替え
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function toggleVisibility($id)
    {
        $announcement = Announcement::whereNull('deleted_at')->findOrFail($id);

        if ($announcement->status === 'published') {
            $announcement->update([
                'status' => 'hidden',
                'updated_by' => Auth::id(),
            ]);
            $message = 'お知らせを非表示にしました。';
        } elseif ($announcement->status === 'hidden') {
            $updateData = [
                'status' => 'published',
                'updated_by' => Auth::id(),
            ];
            
            // published_at が未設定の場合は現在時刻を設定
            if (!$announcement->published_at) {
                $updateData['published_at'] = now();
            }
            
            $announcement->update($updateData);
            $message = 'お知らせを公開しました。';
        } else {
            return response()->json([
                'success' => false,
                'message' => '下書きまたは公開予約中のお知らせは表示/非表示を切り替えできません。',
            ], 400);
        }

        $announcement->load(['creator:id,name', 'updater:id,name']);

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => [
                'announcement' => $announcement,
            ],
        ]);
    }
}
