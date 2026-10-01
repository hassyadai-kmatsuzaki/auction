<?php

namespace Tests\Unit\Services\AI\ML;

use App\Services\AI\ML\Metrics;
use App\Services\AI\ML\PriceFeatureEncoder;
use App\Services\AI\ML\RidgeRegression;
use PHPUnit\Framework\TestCase;

class RidgeRegressionTest extends TestCase
{
    public function test_recovers_linear_relationship(): void
    {
        // y = 2 + 3*x1 - 1.5*x2（列0は切片）
        $samples = [];
        $targets = [];
        for ($i = 0; $i < 50; $i++) {
            $x1 = ($i % 7) - 3;
            $x2 = ($i % 5) - 2;
            $samples[] = [0 => 1.0, 1 => (float) $x1, 2 => (float) $x2];
            $targets[] = 2 + 3 * $x1 - 1.5 * $x2;
        }

        $model = new RidgeRegression(1e-6, 3);
        $model->fit($samples, $targets);

        $this->assertEqualsWithDelta(2.0, $model->weights()[0], 1e-4);
        $this->assertEqualsWithDelta(3.0, $model->weights()[1], 1e-4);
        $this->assertEqualsWithDelta(-1.5, $model->weights()[2], 1e-4);
        $this->assertEqualsWithDelta(2 + 3 * 1 - 1.5 * 1, $model->predict([0 => 1.0, 1 => 1.0, 2 => 1.0]), 1e-4);
    }

    public function test_regularization_shrinks_weights_and_survives_serialization(): void
    {
        $samples = [[0 => 1.0, 1 => 1.0], [0 => 1.0, 1 => -1.0], [0 => 1.0, 1 => 2.0]];
        $targets = [3.0, -1.0, 5.0];

        $weak = new RidgeRegression(0.0001, 2);
        $weak->fit($samples, $targets);
        $strong = new RidgeRegression(100.0, 2);
        $strong->fit($samples, $targets);

        $this->assertLessThan(abs($weak->weights()[1]), abs($strong->weights()[1]));

        $restored = RidgeRegression::fromArray(json_decode(json_encode($strong->toArray()), true));
        $this->assertEqualsWithDelta($strong->predict([0 => 1.0, 1 => 0.5]), $restored->predict([0 => 1.0, 1 => 0.5]), 1e-12);
    }

    public function test_metrics(): void
    {
        $actual = [100.0, 200.0, 400.0];
        $predicted = [110.0, 150.0, 400.0];

        $this->assertEqualsWithDelta(20.0, Metrics::mae($actual, $predicted), 1e-9);
        $this->assertEqualsWithDelta(10.0, Metrics::medianApe($actual, $predicted), 1e-9);
        $this->assertEqualsWithDelta(200 / 3, Metrics::withinRate($actual, $predicted, 0.2), 1e-9);
    }

    public function test_species_normalization(): void
    {
        $this->assertSame('紅薊', PriceFeatureEncoder::normalizeSpecies('紅薊 (A)'));
        $this->assertSame('紅薊', PriceFeatureEncoder::normalizeSpecies('紅薊（Ａ）'));
        $this->assertSame('楊貴妃', PriceFeatureEncoder::normalizeSpecies('楊貴妃メダカ'));
        $this->assertSame('三色ラメ', PriceFeatureEncoder::normalizeSpecies('三色ラメ Aランク'));
        $this->assertSame('耀龍アースアイ', PriceFeatureEncoder::normalizeSpecies('耀龍アースアイ 4ペア+'));
        $this->assertSame('銀星スワロー', PriceFeatureEncoder::normalizeSpecies('銀星スワロー 1ペア'));
        $this->assertSame(['紅白', '白ラ', 'ラメ'], PriceFeatureEncoder::bigrams('紅白ラメ'));
    }
}
