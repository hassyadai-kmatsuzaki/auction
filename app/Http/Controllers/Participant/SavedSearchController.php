<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use App\Models\SavedSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SavedSearchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $searches = SavedSearch::where('user_id', $request->user()->id)
            ->orderByDesc('updated_at')
            ->get();

        return response()->json(['success' => true, 'data' => $searches]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'conditions' => 'required|array',
            'notify_on_match' => 'boolean',
        ]);

        $count = SavedSearch::where('user_id', $request->user()->id)->count();
        if ($count >= 20) {
            return response()->json([
                'success' => false,
                'message' => '保存できる検索条件は20件までです',
            ], 422);
        }

        $search = SavedSearch::create([
            'user_id' => $request->user()->id,
            'name' => $request->name,
            'conditions' => $request->conditions,
            'notify_on_match' => $request->notify_on_match ?? false,
        ]);

        return response()->json(['success' => true, 'data' => $search], 201);
    }

    public function destroy(int $id, Request $request): JsonResponse
    {
        $search = SavedSearch::where('user_id', $request->user()->id)
            ->findOrFail($id);
        $search->delete();

        return response()->json(['success' => true, 'message' => '削除しました']);
    }
}
