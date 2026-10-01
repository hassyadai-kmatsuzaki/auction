<?php

namespace App\Services\AI\ML;

/**
 * 学習アルゴリズムの共通インターフェース（F-053）
 * 新しいアルゴリズムはこれを実装すれば、学習・評価・登録・推論の流れにそのまま載る。
 */
interface Estimator
{
    /**
     * @param  array<int, array<int, float>>  $samples  特徴量ベクトルの配列
     * @param  array<int, float>  $targets
     */
    public function fit(array $samples, array $targets): void;

    /**
     * @param  array<int, float>  $sample
     */
    public function predict(array $sample): float;

    public function algorithm(): string;

    /** 保存用 */
    public function toArray(): array;

    public static function fromArray(array $data): static;
}
