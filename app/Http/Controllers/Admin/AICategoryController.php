<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Services\AI\NLPService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 自動カテゴリ分類（F-055・ベータ）
 * AI分析センターの「自動カテゴリ分類」カードから開くダイアログ用。
 */
class AICategoryController extends Controller
{
    /** 1オークションで一括分類する生体の上限 */
    private const MAX_ITEMS = 500;

    /**
     * 品種名（＋説明文）を1件分類
     * POST /api/admin/ai/categories/classify
     */
    public function classify(Request $request, NLPService $service): JsonResponse
    {
        $validated = $request->validate([
            'species_name' => 'required|string|max:200',
            'description' => 'nullable|string|max:2000',
        ]);

        $text = trim($validated['species_name'] . ' ' . ($validated['description'] ?? ''));
        $result = $service->classifyTexts([$text])[$text];

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    /**
     * オークション内の生体を品種名で一括分類
     * GET /api/admin/ai/categories/auction/{auctionId}
     */
    public function classifyAuctionItems(int $auctionId, NLPService $service): JsonResponse
    {
        $items = Item::where('auction_id', $auctionId)
            ->where('status', '!=', 'cancelled')
            ->orderBy('item_number')
            ->orderBy('id')
            ->limit(self::MAX_ITEMS)
            ->get(['id', 'item_number', 'species_name', 'quantity', 'quantity_unit']);

        $classified = $service->classifyTexts($items->pluck('species_name')->all());

        $rows = $items->map(function (Item $item) use ($classified) {
            $result = $classified[trim((string) $item->species_name)] ?? null;

            return [
                'item_id' => $item->id,
                'item_number' => $item->item_number,
                'species_name' => $item->species_name,
                'quantity' => $item->quantity,
                'quantity_unit' => $item->quantity_unit,
                'category' => $result['category'] ?? null,
                'label' => $result['label'] ?? null,
                'source' => $result['source'] ?? null,
            ];
        })->values();

        $summary = collect(NLPService::CATEGORY_LABELS)
            ->map(fn ($label, $code) => [
                'category' => $code,
                'label' => $label,
                'count' => $rows->where('category', $code)->count(),
            ])->values();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $rows,
                'summary' => $summary,
                'ai_enabled' => !empty(config('services.openai.api_key')),
            ],
        ]);
    }
}
