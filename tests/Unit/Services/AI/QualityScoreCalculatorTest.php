<?php

namespace Tests\Unit\Services\AI;

use App\Services\AI\QualityScoreCalculator;
use PHPUnit\Framework\TestCase;

class QualityScoreCalculatorTest extends TestCase
{
    private QualityScoreCalculator $calc;

    protected function setUp(): void
    {
        $this->calc = new QualityScoreCalculator();
    }

    public function test_weights_sum_to_one(): void
    {
        $this->assertEqualsWithDelta(1.0, array_sum(QualityScoreCalculator::WEIGHTS), 1e-9);
    }

    public function test_weighted_score_from_axis_scores(): void
    {
        $r = $this->calc->calculate(['quality_scores' => ['body_shape' => 10, 'color' => 5, 'pattern' => 0], 'quality_score' => 7]);

        $this->assertSame(5.8, $r['score']); // 4.0 + 1.75 + 0 = 5.75 → 5.8
        $this->assertSame('weighted_v1', $r['breakdown']['method']);
        $this->assertSame(7.0, $r['breakdown']['ai_overall']);
    }

    public function test_same_axis_scores_always_give_same_total(): void
    {
        $in = ['quality_scores' => ['body_shape' => 7.5, 'color' => 8.1, 'pattern' => 6.0]];

        $this->assertSame($this->calc->calculate($in)['score'], $this->calc->calculate($in + ['quality_score' => 1])['score']);
    }

    public function test_falls_back_to_ai_overall_when_axis_missing(): void
    {
        // 従来形式の応答（観点別が無い）でも今までと同じ値になる
        $r = $this->calc->calculate(['quality_score' => 8.5, 'quality_scores' => ['body_shape' => 8, 'color' => 'x']]);

        $this->assertSame(8.5, $r['score']);
        $this->assertSame('ai_overall', $r['breakdown']['method']);
    }

    public function test_out_of_range_values_are_clamped_and_non_numeric_is_null(): void
    {
        $r = $this->calc->calculate(['quality_scores' => ['body_shape' => 15, 'color' => -3, 'pattern' => 10]]);
        $this->assertSame(6.5, $r['score']); // 10*0.4 + 0 + 10*0.25

        $this->assertNull($this->calc->calculate([])['score']);
        $this->assertNull($this->calc->calculate(['quality_score' => '不明'])['score']);
    }
}
