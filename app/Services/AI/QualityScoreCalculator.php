<?php

namespace App\Services\AI;

/**
 * 品質スコアの算出（F-052）。
 *
 * AI（画像解析）が体型・色彩・模様の3観点を、決められた採点基準で 0〜10 点ずつ採点し、
 * 総合点はここで固定の重みで計算する。AI に総合点を丸投げすると解析ごとに基準が揺れるため、
 * 「観点別の採点＝AI」「合成＝決まった式」に分けて、同じ採点なら必ず同じ総合点になるようにする。
 */
class QualityScoreCalculator
{
    public const METHOD = 'weighted_v1';

    /** 観点の重み（合計 1.0）。メダカの評価で体型の欠点が最も値段に響くため体型を重くする */
    public const WEIGHTS = [
        'body_shape' => 0.40,
        'color' => 0.35,
        'pattern' => 0.25,
    ];

    /** AI に渡す採点基準（プロンプトに埋め込む） */
    public const RUBRIC = <<<'EOT'
quality_scores: 観点別の品質スコア（各 0-10 の小数点1桁）。次の基準で採点すること
  - body_shape: 背骨の曲がり・ヒレの欠けや縮れが無いほど高い。体高・体幅のバランスが良いほど高い
  - color: 体色が濃く、ムラが無く均一なほど高い。光沢・ラメがある品種はその量と輝きが良いほど高い
  - pattern: 模様が品種の特徴どおりに明瞭で、左右対称なほど高い。模様が無い品種は体色の均一性で評価する
EOT;

    /**
     * AI の応答から品質スコアと内訳を計算する。
     * 観点別スコアが揃っていなければ、従来どおり AI の総合点（quality_score）をそのまま使う
     *
     * @return array{score: float|null, breakdown: array}
     */
    public function calculate(array $aiResponse): array
    {
        $aiOverall = $this->normalize($aiResponse['quality_score'] ?? null);
        $scores = [];
        foreach (array_keys(self::WEIGHTS) as $axis) {
            $scores[$axis] = $this->normalize($aiResponse['quality_scores'][$axis] ?? null);
        }

        if (in_array(null, $scores, true)) {
            return [
                'score' => $aiOverall,
                'breakdown' => ['method' => 'ai_overall', 'ai_overall' => $aiOverall],
            ];
        }

        $weighted = 0.0;
        foreach (self::WEIGHTS as $axis => $weight) {
            $weighted += $scores[$axis] * $weight;
        }

        return [
            'score' => round($weighted, 1),
            'breakdown' => [
                'method' => self::METHOD,
                'scores' => $scores,
                'weights' => self::WEIGHTS,
                'ai_overall' => $aiOverall,
            ],
        ];
    }

    /** 0〜10 の数値に揃える。数値でなければ null（範囲外は丸める） */
    private function normalize(mixed $value): ?float
    {
        if (!is_numeric($value)) {
            return null;
        }

        return round(min(10.0, max(0.0, (float) $value)), 1);
    }
}
