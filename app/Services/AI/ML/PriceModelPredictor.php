<?php

namespace App\Services\AI\ML;

use App\Models\AIModel;
use App\Models\Item;

/**
 * 有効化された価格予測モデルで落札単価を推論する（F-053）
 */
class PriceModelPredictor
{
    private ?AIModel $model = null;
    private ?PriceFeatureEncoder $encoder = null;
    private ?RidgeRegression $estimator = null;
    private bool $loaded = false;

    /**
     * @return array{price: int, low: int, high: int, confidence: float, species_known: bool, model: AIModel}|null 有効なモデルが無ければ null
     */
    public function predict(Item $item): ?array
    {
        if (!$this->load()) {
            return null;
        }

        $eventDate = $item->auction?->event_date;
        $features = [
            'species_name' => $item->species_name,
            'species_type_id' => $item->species_type_id,
            'seller_profile_id' => $item->seller_profile_id,
            'quantity' => (int) $item->quantity,
            'quantity_unit' => $item->quantity_unit,
            'start_price' => (int) $item->start_price,
            'is_premium' => (bool) $item->is_premium,
            'event_month' => $eventDate?->month,
        ];

        $logPrice = $this->estimator->predict($this->encoder->transform($features));
        $metrics = $this->model->metrics ?? [];
        $sigma = max(0.05, (float) ($metrics['residual_std_log'] ?? 0.5));
        $speciesKnown = $this->encoder->knowsSpecies((string) $item->species_name);

        // 信頼度: 直近の開催での「±30%以内に入った割合」を基準に、学習時に十分な件数が無かった品種は割り引く
        $confidence = (float) ($metrics['within_30pct_rate'] ?? 50);
        if (!$speciesKnown) {
            $confidence *= 0.6;
        }

        return [
            'price' => (int) round(exp($logPrice)),
            'low' => (int) round(exp($logPrice - $sigma)),
            'high' => (int) round(exp($logPrice + $sigma)),
            'confidence' => round(min(95.0, max(5.0, $confidence)), 1),
            'species_known' => $speciesKnown,
            'model' => $this->model,
        ];
    }

    private function load(): bool
    {
        if (!$this->loaded) {
            $this->loaded = true;
            $this->model = AIModel::active(PriceModelTrainer::MODEL_NAME);
            if ($this->model) {
                $artifact = $this->model->artifact;
                $this->encoder = PriceFeatureEncoder::fromArray($artifact['encoder']);
                $this->estimator = RidgeRegression::fromArray($artifact['estimator']);
            }
        }

        return $this->model !== null;
    }
}
