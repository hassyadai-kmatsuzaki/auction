<?php

namespace App\Services\AI;

use App\Models\AIPricePrediction;
use App\Models\Item;
use App\Models\WonItem;
use App\Services\AI\ML\PriceModelPredictor;
use Illuminate\Support\Facades\DB;

class PricePredictionService
{
    /**
     * 集計対象とする入金済みステータス（入金確認後は paid → confirmed に進む）
     */
    private const SETTLED_PAYMENT_STATUSES = ['paid', 'confirmed'];

    public function __construct(
        private readonly PriceModelPredictor $modelPredictor = new PriceModelPredictor(),
    ) {}

    /**
     * 商品の予想落札価格を算出
     * 有効な機械学習モデル（F-053）があればそれを使い、無ければ品種の過去取引からの統計で算出する。
     */
    public function predictPrice(Item $item): AIPricePrediction
    {
        $ml = $this->modelPredictor->predict($item);
        if ($ml !== null) {
            $metrics = $ml['model']->metrics ?? [];

            return AIPricePrediction::updateOrCreate(
                ['item_id' => $item->id],
                [
                    'species_name' => $item->species_name,
                    'predicted_price' => $ml['price'],
                    'price_low' => $ml['low'],
                    'price_high' => $ml['high'],
                    'confidence' => $ml['confidence'],
                    'factors' => [
                        ['type' => 'model', 'value' => $ml['model']->label()],
                        ['type' => 'trained_samples', 'value' => $ml['model']->train_samples + $ml['model']->test_samples],
                        ['type' => 'recent_median_error_pct', 'value' => $metrics['median_error_pct'] ?? null],
                        ['type' => 'species_known', 'value' => $ml['species_known']],
                        ['type' => 'species', 'value' => $item->species_name],
                    ],
                    'model_version' => $ml['model']->label(),
                ],
            );
        }

        $speciesName = $item->species_name;

        // 同品種の過去取引データを取得
        // STDDEV は SQLite で未対応のため、価格列を取得して PHP 側で集計する
        $prices = WonItem::join('items', 'won_items.item_id', '=', 'items.id')
            ->where('items.species_name', $speciesName)
            ->whereIn('won_items.payment_status', self::SETTLED_PAYMENT_STATUSES)
            ->pluck('won_items.winning_price')
            ->map(fn ($v) => (float) $v);

        $sampleCount = $prices->count();
        $avgPrice = $sampleCount > 0 ? $prices->avg() : 0.0;
        $stddev = $sampleCount > 1
            ? sqrt($prices->reduce(fn ($carry, $v) => $carry + ($v - $avgPrice) ** 2, 0.0) / $sampleCount)
            : 0.0;
        $historicalData = (object) [
            'avg_price' => $avgPrice,
            'stddev_price' => $stddev,
            'min_price' => $sampleCount > 0 ? $prices->min() : 0,
            'max_price' => $sampleCount > 0 ? $prices->max() : 0,
            'sample_count' => $sampleCount,
        ];

        // 最近のトレンド（直近30日）
        $recentTrend = WonItem::join('items', 'won_items.item_id', '=', 'items.id')
            ->where('items.species_name', $speciesName)
            ->where('won_items.created_at', '>=', now()->subDays(30))
            ->whereIn('won_items.payment_status', self::SETTLED_PAYMENT_STATUSES)
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
            ->whereIn('won_items.payment_status', self::SETTLED_PAYMENT_STATUSES)
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
            // MySQL の集計値は文字列で返るため、グラフ描画用に数値へ揃える
            ->map(fn ($row) => [
                'species_name' => $row->species_name,
                'transaction_count' => (int) $row->transaction_count,
                'avg_price' => round((float) $row->avg_price),
                'max_price' => (float) $row->max_price,
                'min_price' => (float) $row->min_price,
            ])
            ->toArray();
    }
}
