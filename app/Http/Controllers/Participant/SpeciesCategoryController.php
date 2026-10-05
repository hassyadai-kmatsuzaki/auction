<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use App\Models\SpeciesName;
use Illuminate\Http\JsonResponse;

/**
 * 出品一覧のカテゴリ（F-013）。品種名マスタの有効な名前を並び順どおりに返す（読み取り専用）
 */
class SpeciesCategoryController extends Controller
{
    public function index(): JsonResponse
    {
        abort_unless(config('features.item_category'), 404);

        $names = SpeciesName::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->pluck('name');

        return response()->json(['success' => true, 'data' => $names]);
    }
}
