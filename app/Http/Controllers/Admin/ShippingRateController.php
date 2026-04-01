<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ShippingRate;
use App\Models\PackingMaterial;
use App\Models\BagSpec;
use App\Models\BoxSpec;
use App\Services\ShippingCalculatorService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ShippingRateController extends Controller
{
    /**
     * 全配送マスタデータ取得
     */
    public function index()
    {
        // 送料テーブル（地域×箱サイズのマトリクス形式）
        $rates = ShippingRate::orderBy('region')->orderBy('box_size')->get();
        $rateMatrix = [];
        foreach ($rates as $rate) {
            $rateMatrix[$rate->region][$rate->box_size] = $rate->rate;
        }

        return response()->json([
            'success' => true,
            'data' => [
                'shipping_rates' => $rateMatrix,
                'packing_materials' => PackingMaterial::orderBy('box_size')->get(),
                'bag_specs' => BagSpec::orderBy('min_qty')->get(),
                'box_specs' => BoxSpec::orderBy('box_size')->get(),
            ],
        ]);
    }

    /**
     * 送料テーブル更新（マトリクス形式）
     */
    public function updateRates(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'rates' => 'required|array',
            'rates.*.region' => 'required|string',
            'rates.*.box_size' => 'required|integer|in:80,100,120,140',
            'rates.*.rate' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        foreach ($request->input('rates') as $row) {
            ShippingRate::updateOrCreate(
                ['region' => $row['region'], 'box_size' => $row['box_size']],
                ['rate' => $row['rate'], 'updated_at' => now()]
            );
        }

        ShippingCalculatorService::clearCache();

        return response()->json(['success' => true, 'message' => '送料テーブルを更新しました。']);
    }

    /**
     * 梱包資材費更新
     */
    public function updatePackingMaterials(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'materials' => 'required|array',
            'materials.*.box_size' => 'required|integer|in:80,100,120,140',
            'materials.*.styrofoam_cost' => 'required|integer|min:0',
            'materials.*.bag_material_cost' => 'required|integer|min:0',
            'materials.*.coolant_cost' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        foreach ($request->input('materials') as $row) {
            PackingMaterial::updateOrCreate(
                ['box_size' => $row['box_size']],
                [
                    'styrofoam_cost' => $row['styrofoam_cost'],
                    'bag_material_cost' => $row['bag_material_cost'],
                    'coolant_cost' => $row['coolant_cost'],
                    'updated_at' => now(),
                ]
            );
        }

        ShippingCalculatorService::clearCache();

        return response()->json(['success' => true, 'message' => '梱包資材費を更新しました。']);
    }
}
