<?php

namespace App\Services\AI;

use App\Models\AIPricePrediction;
use App\Models\Item;
use App\Models\WonItem;
use Illuminate\Support\Facades\DB;

class PricePredictionService
{
    /**
     * 商品の予想落札価格を算出
     */
    public function predictPrice(Item $item): AIPricePrediction
    {
        $speciesName = $item->species_name;

        // 同品種の過去取引データを取得
        $historicalData = WonItem::join('items', 'won_items.item_id', '=', 'items.id')
            ->where('items.species_name', $speciesName)
            ->where('won_items.payment_status', 'paid')
            ->selectRaw('
                AVG(won_items.winning_price) as avg_price,
                STDDEV(won_items.winning_price) as stddev_price,
                MIN(won_items.winning_price) as min_price,
                MAX(won_items.winning_price) as max_price,
                COUNT(*) as sample_count
            ')
            ->first();

        // 最近のトレンド（直近30日）
        $recentTrend = WonItem::join('items', 'won_items.item_id', '=', 'items.id')
            ->where('items.species_name', $speciesName)
            ->where('won_items.created_at', '>=', now()->subDays(30))
            ->where('won_items.payment_status', 'paid')
            ->selectRaw('AVG(won_items.winning_price) as recent_avg, COUNT(*) as recent_count')
            ->first();

        // 数量による補正
        $quantityFactor = $this->calculateQuantityFactor($item->quantity, $speciesName);

        // 予測計算
        $factors = [];
        $sampleCount = (int) $historicalData->sample_count;

        if ($sampleCount >= 3) {
            $basePrice = (float) $historicalData->avg_price;
            $stddev = (float) ($historicalData->stddev_price ?? 0);

            // トレンド補正
            if ($recentTrend->recent_count >= 2) {
                $trendRatio = $recentTrend->recent_avg / max($basePrice, 1);
                $basePrice *= (1 + ($trendRatio - 1) * 0.3); // トレンドを30%反映
                $factors[] = ['type' => 'trend', 'value' => round($trendRatio, 2)];
            }

            // 数量補正
            $basePrice *= $quantityFactor;
            $factors[] = ['type' => 'quantity', 'value' => round($quantityFactor, 2)];

            $predictedPrice = max((int) round($basePrice), $item->start_price);
            $priceLow = max((int) round($basePrice - $stddev), $item->start_price);
            $priceHigh = (int) round($basePrice + $stddev);

            // 信頼度（サンプル数とばらつきに基づく）
            $cvRatio = $basePrice > 0 ? $stddev / $basePrice : 1;
            $confidence = min(95, max(10, (1 - $cvRatio) * 100 * min(1, $sampleCount / 20)));
        } else {
            // データ不足: 開始価格ベースの推定
            $predictedPrice = (int) ($item->start_price * 1.5);
            $priceLow = $item->start_price;
            $priceHigh = $item->start_price * 3;
            $confidence = 10;
            $factors[] = ['type' => 'insufficient_data', 'value' => $sampleCount];
        }

        $factors[] = ['type' => 'historical_samples', 'value' => $sampleCount];
        $factors[] = ['type' => 'species', 'value' => $speciesName];

        return AIPricePrediction::updateOrCreate(
            ['item_id' => $item->id],
            [
                'species_name' => $speciesName,
                'predicted_price' => $predictedPrice,
                'price_low' => $priceLow,
                'price_high' => $priceHigh,
                'confidence' => round($confidence, 1),
                'factors' => $factors,
                'model_version' => 'statistical_v1',
            ],
        );
    }

    /**
     * 数量による価格補正係数を計算
     */
    private function calculateQuantityFactor(int $quantity, string $speciesName): float
    {
        $avgQuantity = (float) (DB::table('items')
            ->where('species_name', $speciesName)
            ->avg('quantity') ?? 1);

        if ($avgQuantity <= 0) return 1.0;

        $ratio = $quantity / $avgQuantity;

        // 数量が多いと単価は下がる傾向
        if ($ratio > 1.5) return 0.85;
        if ($ratio > 1.2) return 0.93;
        if ($ratio < 0.5) return 1.15;
        if ($ratio < 0.8) return 1.07;

        return 1.0;
    }

    /**
     * 品種別の市場動向を取得
     */
    public function getMarketTrends(int $limit = 20): array
    {
        return WonItem::join('items', 'won_items.item_id', '=', 'items.id')
            ->where('won_items.payment_status', 'paid')
            ->where('won_items.created_at', '>=', now()->subDays(90))
            ->groupBy('items.species_name')
            ->selectRaw('
                items.species_name,
                COUNT(*) as transaction_count,
                AVG(won_items.winning_price) as avg_price,
                MAX(won_items.winning_price) as max_price,
                MIN(won_items.winning_price) as min_price
            ')
            ->having('transaction_count', '>=', 2)
            ->orderByDesc('transaction_count')
            ->limit($limit)
            ->get()
            ->toArray();
    }
}
