<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Models\SpeciesType;

/**
 * 出品者向けの種別一覧取得（読み取り専用）
 */
class SpeciesTypeController extends Controller
{
    public function index()
    {
        $types = SpeciesType::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['id', 'code', 'name', 'calculation_mode', 'allowed_quantity_units', 'is_default', 'sort_order']);

        return response()->json(['success' => true, 'data' => $types]);
    }
}
