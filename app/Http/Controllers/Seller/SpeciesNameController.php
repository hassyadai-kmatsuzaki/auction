<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Models\SpeciesName;

/**
 * 出品者向けの品種名（生体名）候補一覧（読み取り専用）。
 * 出品申込フォームの入力補助（変換候補）に使う。
 */
class SpeciesNameController extends Controller
{
    public function index()
    {
        $names = SpeciesName::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->pluck('name');

        return response()->json(['success' => true, 'data' => $names]);
    }
}
