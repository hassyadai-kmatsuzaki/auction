<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Services\AI\MatchingService;
use App\Services\AI\ML\PriceModelPredictor;
use Illuminate\Http\JsonResponse;

/**
 * マッチング（F-059・基本版）
 * レコメンド画面の結果から「この出品物の見込み買受者」を開くダイアログ用。
 */
class AIMatchingController extends Controller
{
    /**
     * GET /api/admin/ai/matching/items/{itemId}/buyers
     */
    public function buyersForItem(int $itemId, MatchingService $matching, PriceModelPredictor $predictor): JsonResponse
    {
        $item = Item::with('auction:id,event_date')->findOrFail($itemId);

        // 想定落札単価: 機械学習モデル（F-053）があればその予測、無ければ開始価格
        $prediction = $predictor->predict($item);
        $expected = $prediction['price'] ?? (float) $item->start_price;

        return response()->json([
            'success' => true,
            'data' => [
                'item' => [
                    'id' => $item->id,
                    'item_number' => $item->item_number,
                    'species_name' => $item->species_name,
                    'start_price' => $item->start_price,
                    'expected_price' => (int) round($expected),
                    'expected_price_source' => $prediction ? $prediction['model']->label() : 'start_price',
                ],
                'buyers' => $matching->matchBuyersForItem($item, 10, null, (float) $expected),
            ],
        ]);
    }
}
