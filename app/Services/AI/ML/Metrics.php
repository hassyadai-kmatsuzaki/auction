<?php

namespace App\Services\AI\ML;

/**
 * 回帰モデルの評価指標（F-053）
 */
class Metrics
{
    /** 平均絶対誤差（円） */
    public static function mae(array $actual, array $predicted): float
    {
        $n = count($actual);
        if ($n === 0) {
            return 0.0;
        }
        $sum = 0.0;
        foreach ($actual as $i => $a) {
            $sum += abs($a - $predicted[$i]);
        }
        return $sum / $n;
    }

    /** 誤差率の中央値（%）。外れ値の影響を受けにくい「ふだんどれくらい外れるか」 */
    public static function medianApe(array $actual, array $predicted): float
    {
        $errors = [];
        foreach ($actual as $i => $a) {
            if ($a > 0) {
                $errors[] = abs($a - $predicted[$i]) / $a * 100;
            }
        }
        return self::median($errors);
    }

    /** 予測が実際の ±30% 以内に入った割合（%） */
    public static function withinRate(array $actual, array $predicted, float $tolerance = 0.3): float
    {
        $n = count($actual);
        if ($n === 0) {
            return 0.0;
        }
        $hits = 0;
        foreach ($actual as $i => $a) {
            if ($a > 0 && abs($a - $predicted[$i]) / $a <= $tolerance) {
                $hits++;
            }
        }
        return $hits / $n * 100;
    }

    /** 決定係数 */
    public static function r2(array $actual, array $predicted): float
    {
        $n = count($actual);
        if ($n === 0) {
            return 0.0;
        }
        $mean = array_sum($actual) / $n;
        $ssRes = 0.0;
        $ssTot = 0.0;
        foreach ($actual as $i => $a) {
            $ssRes += ($a - $predicted[$i]) ** 2;
            $ssTot += ($a - $mean) ** 2;
        }
        return $ssTot > 0 ? 1 - $ssRes / $ssTot : 0.0;
    }

    public static function std(array $values): float
    {
        $n = count($values);
        if ($n < 2) {
            return 0.0;
        }
        $mean = array_sum($values) / $n;
        return sqrt(array_sum(array_map(fn ($v) => ($v - $mean) ** 2, $values)) / ($n - 1));
    }

    public static function median(array $values): float
    {
        $n = count($values);
        if ($n === 0) {
            return 0.0;
        }
        sort($values);
        $mid = intdiv($n, 2);
        return $n % 2 ? (float) $values[$mid] : ($values[$mid - 1] + $values[$mid]) / 2;
    }
}
