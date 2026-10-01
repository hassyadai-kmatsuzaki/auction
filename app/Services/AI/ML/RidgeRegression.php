<?php

namespace App\Services\AI\ML;

use RuntimeException;

/**
 * リッジ回帰（L2 正則化付き線形回帰）
 *
 * 特徴量は疎ベクトル（[列番号 => 値]）で受け取る。列 0 は切片として常に 1 を入れる前提で、切片は正則化しない。
 * 正規方程式 (XᵀX + λI)w = Xᵀy をコレスキー分解で解く。
 */
class RidgeRegression implements Estimator
{
    /** @var array<int, float> */
    private array $weights = [];

    public function __construct(
        private readonly float $lambda = 1.0,
        private readonly int $dimensions = 0,
    ) {}

    public function fit(array $samples, array $targets): void
    {
        $d = $this->dimensions;
        if ($d < 1 || count($samples) === 0 || count($samples) !== count($targets)) {
            throw new RuntimeException('学習データが不正です');
        }

        // XᵀX と Xᵀy を疎ベクトルのまま積み上げる（1件あたり非ゼロ要素数の2乗で済む）
        $xtx = array_fill(0, $d, array_fill(0, $d, 0.0));
        $xty = array_fill(0, $d, 0.0);
        foreach ($samples as $n => $x) {
            $y = (float) $targets[$n];
            foreach ($x as $i => $vi) {
                $xty[$i] += $vi * $y;
                foreach ($x as $j => $vj) {
                    $xtx[$i][$j] += $vi * $vj;
                }
            }
        }
        for ($i = 1; $i < $d; $i++) {
            $xtx[$i][$i] += $this->lambda;
        }
        // 一度も出てこない列があっても解けるよう、ごく小さな値を足しておく
        $xtx[0][0] += 1e-9;

        $this->weights = $this->solveCholesky($xtx, $xty);
    }

    public function predict(array $sample): float
    {
        $sum = 0.0;
        foreach ($sample as $i => $v) {
            $sum += ($this->weights[$i] ?? 0.0) * $v;
        }
        return $sum;
    }

    /** @return array<int, float> */
    public function weights(): array
    {
        return $this->weights;
    }

    public function algorithm(): string
    {
        return 'ridge_regression';
    }

    public function toArray(): array
    {
        return ['lambda' => $this->lambda, 'dimensions' => $this->dimensions, 'weights' => $this->weights];
    }

    public static function fromArray(array $data): static
    {
        $model = new static((float) $data['lambda'], (int) $data['dimensions']);
        $model->weights = array_map('floatval', $data['weights']);
        return $model;
    }

    /**
     * 対称正定値行列 A について Aw = b を解く
     *
     * @param  array<int, array<int, float>>  $a
     * @param  array<int, float>  $b
     * @return array<int, float>
     */
    private function solveCholesky(array $a, array $b): array
    {
        $n = count($b);
        $l = array_fill(0, $n, array_fill(0, $n, 0.0));

        for ($i = 0; $i < $n; $i++) {
            for ($j = 0; $j <= $i; $j++) {
                $sum = $a[$i][$j];
                for ($k = 0; $k < $j; $k++) {
                    $sum -= $l[$i][$k] * $l[$j][$k];
                }
                if ($i === $j) {
                    if ($sum <= 0.0) {
                        throw new RuntimeException('行列が正定値ではありません（正則化を強めてください）');
                    }
                    $l[$i][$i] = sqrt($sum);
                } else {
                    $l[$i][$j] = $sum / $l[$j][$j];
                }
            }
        }

        // L z = b（前進代入）
        $z = array_fill(0, $n, 0.0);
        for ($i = 0; $i < $n; $i++) {
            $sum = $b[$i];
            for ($k = 0; $k < $i; $k++) {
                $sum -= $l[$i][$k] * $z[$k];
            }
            $z[$i] = $sum / $l[$i][$i];
        }

        // Lᵀ w = z（後退代入）
        $w = array_fill(0, $n, 0.0);
        for ($i = $n - 1; $i >= 0; $i--) {
            $sum = $z[$i];
            for ($k = $i + 1; $k < $n; $k++) {
                $sum -= $l[$k][$i] * $w[$k];
            }
            $w[$i] = $sum / $l[$i][$i];
        }

        return $w;
    }
}
