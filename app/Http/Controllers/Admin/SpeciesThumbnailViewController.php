<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SpeciesThumbnailView;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * 撮影ビュー設定（生体名 → 上見/横見）の管理。
 * 品種マスタではなく、サムネ向きを決定的に固定するための軽量マッピングのCRUD。
 * ルート: /api/admin/masters/thumbnail-views
 */
class SpeciesThumbnailViewController extends Controller
{
    /** 登録済み一覧（生体名昇順）。 */
    public function index(): JsonResponse
    {
        $views = SpeciesThumbnailView::orderBy('species_name')->get();

        return response()->json(['success' => true, 'data' => $views]);
    }

    /** 撮影ビューを登録。 */
    public function store(Request $request): JsonResponse
    {
        $validator = $this->validator($request);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $view = SpeciesThumbnailView::create($validator->validated());

        return response()->json(['success' => true, 'data' => $view], 201);
    }

    /** 撮影ビューを更新。 */
    public function update(Request $request, int $id): JsonResponse
    {
        $view = SpeciesThumbnailView::findOrFail($id);

        $validator = $this->validator($request, $view->id);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $view->update($validator->validated());

        return response()->json(['success' => true, 'data' => $view->fresh()]);
    }

    /** 撮影ビュー設定を削除（生体名は再び「未設定」一覧に戻る）。 */
    public function destroy(int $id): JsonResponse
    {
        $view = SpeciesThumbnailView::findOrFail($id);
        $view->delete();

        return response()->json(['success' => true]);
    }

    /**
     * ビュー未設定の生体名一覧（出現件数つき）。
     * items に出てくるが thumbnail-views に未登録の生体名を導出する。
     */
    public function unregistered(): JsonResponse
    {
        $rows = SpeciesThumbnailView::unregisteredItemsQuery()
            ->select(
                'species_name',
                DB::raw('COUNT(*) as item_count'),
                DB::raw('MAX(created_at) as last_seen_at'),
            )
            ->groupBy('species_name')
            ->orderByDesc('item_count')
            ->orderBy('species_name')
            ->get()
            ->map(fn ($r) => [
                'species_name' => $r->species_name,
                'item_count'   => (int) $r->item_count,
                'last_seen_at' => $r->last_seen_at,
            ]);

        return response()->json([
            'success' => true,
            'data'    => [
                'unregistered_count' => $rows->count(),
                'species'            => $rows,
            ],
        ]);
    }

    private function validator(Request $request, ?int $ignoreId = null): \Illuminate\Validation\Validator
    {
        return \Illuminate\Support\Facades\Validator::make($request->all(), [
            'species_name'   => [
                'required',
                'string',
                'max:255',
                Rule::unique('species_thumbnail_views', 'species_name')->ignore($ignoreId),
            ],
            'thumbnail_view' => ['required', Rule::in([SpeciesThumbnailView::VIEW_TOP, SpeciesThumbnailView::VIEW_SIDE])],
        ], [
            'species_name.required'   => '生体名を入力してください。',
            'species_name.unique'     => 'この生体名の撮影ビューは既に登録されています。',
            'thumbnail_view.required' => '撮影ビュー（上見/横見）を指定してください。',
            'thumbnail_view.in'       => '撮影ビューは top（上見）または side（横見）のいずれかです。',
        ]);
    }
}
