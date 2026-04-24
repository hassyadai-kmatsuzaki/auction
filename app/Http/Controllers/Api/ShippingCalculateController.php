<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ShippingCalculatorService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ShippingCalculateController extends Controller
{
    public function __construct(
        private ShippingCalculatorService $calculator
    ) {}

    /**
     * 配送料金計算 API
     * POST /api/shipping/calculate
     */
    public function calculate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.species_type_id' => 'nullable|integer|exists:species_types,id',
            'destination_region' => 'required_without:destination_prefecture|string',
            'destination_prefecture' => 'required_without:destination_region|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        // 地域を決定（prefecture指定時はマッピング）
        $region = $request->input('destination_region');
        if (!$region && $request->has('destination_prefecture')) {
            $region = $this->calculator->getRegionByPrefecture($request->input('destination_prefecture'));
            if (!$region) {
                return response()->json([
                    'success' => false,
                    'message' => '指定された都道府県に対応する配送地域が見つかりません。',
                ], 422);
            }
        }

        $result = $this->calculator->calculate($request->input('items'), $region);

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }
}
