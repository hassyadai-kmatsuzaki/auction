<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AI\ImageAnalysisService;
use App\Services\AI\PricePredictionService;
use App\Services\AI\FraudDetectionService;
use App\Services\AI\RecommendationService;
use App\Services\AI\NLPService;
use App\Models\AIImageAnalysis;
use App\Models\AIPricePrediction;
use App\Models\AIFraudAlert;
use App\Models\Item;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AIController extends Controller
{
    // ─── 画像認識 ────────────────────────────────────
    public function analyzeImage(int $itemId, ImageAnalysisService $service): JsonResponse
    {
        $item = Item::with('media')->findOrFail($itemId);
        $result = $service->analyzeItem($item);

        return response()->json([
            'success' => (bool) $result,
            'data' => $result,
        ]);
    }

    public function batchAnalyzeImages(int $auctionId, ImageAnalysisService $service): JsonResponse
    {
        $count = $service->analyzeAuctionItems($auctionId);

        return response()->json([
            'success' => true,
            'message' => "{$count}件の商品を解析しました",
            'data' => ['analyzed_count' => $count],
        ]);
    }

    public function imageAnalysisResults(int $itemId): JsonResponse
    {
        $analysis = AIImageAnalysis::where('item_id', $itemId)->latest()->first();

        return response()->json([
            'success' => true,
            'data' => $analysis,
        ]);
    }

    // ─── 価格予測 ────────────────────────────────────
    public function predictPrice(int $itemId, PricePredictionService $service): JsonResponse
    {
        $item = Item::findOrFail($itemId);
        $prediction = $service->predictPrice($item);

        return response()->json([
            'success' => true,
            'data' => $prediction,
        ]);
    }

    public function marketTrends(PricePredictionService $service): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $service->getMarketTrends(),
        ]);
    }

    // ─── 不正検知 ────────────────────────────────────
    public function runFraudDetection(int $auctionId, FraudDetectionService $service): JsonResponse
    {
        $alerts = $service->analyzeAuction($auctionId);

        return response()->json([
            'success' => true,
            'data' => [
                'new_alerts' => count($alerts),
                'alerts' => $alerts,
            ],
        ]);
    }

    public function fraudAlerts(Request $request, FraudDetectionService $service): JsonResponse
    {
        $alerts = $service->getAlerts($request->only('status', 'severity'));

        return response()->json(['success' => true, 'data' => $alerts]);
    }

    public function resolveFraudAlert(int $id, Request $request): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:resolved,false_positive',
            'notes' => 'nullable|string|max:500',
        ]);

        $alert = AIFraudAlert::findOrFail($id);
        $alert->update([
            'status' => $request->status,
            'resolution_notes' => $request->notes,
            'resolved_by' => $request->user()->id,
            'resolved_at' => now(),
        ]);

        return response()->json(['success' => true, 'data' => $alert]);
    }

    // ─── レコメンド ──────────────────────────────────
    public function generateRecommendations(int $userId, RecommendationService $service): JsonResponse
    {
        $user = \App\Models\User::findOrFail($userId);
        $recs = $service->generateRecommendations($user);

        return response()->json([
            'success' => true,
            'data' => [
                'count' => count($recs),
                'recommendations' => $recs,
            ],
        ]);
    }

    // ─── NLP（商品情報自動抽出） ────────────────────
    public function extractItemInfo(Request $request, NLPService $service): JsonResponse
    {
        $request->validate(['text' => 'required|string|max:2000']);

        $extracted = $service->extractItemInfo($request->text);

        return response()->json([
            'success' => true,
            'data' => $extracted,
        ]);
    }

    public function classifyCategory(Request $request, NLPService $service): JsonResponse
    {
        $request->validate([
            'species_name' => 'required|string',
            'description' => 'nullable|string',
        ]);

        $category = $service->classifyCategory($request->species_name, $request->description);

        return response()->json([
            'success' => true,
            'data' => ['category' => $category],
        ]);
    }

    // ─── AI分析ダッシュボード ────────────────────────
    public function dashboard(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'image_analyses' => AIImageAnalysis::count(),
                'price_predictions' => AIPricePrediction::count(),
                'fraud_alerts' => [
                    'total' => AIFraudAlert::count(),
                    'open' => AIFraudAlert::where('status', 'open')->count(),
                    'investigating' => AIFraudAlert::where('status', 'investigating')->count(),
                ],
                'recommendations_generated' => \App\Models\AIRecommendation::count(),
            ],
        ]);
    }
}
