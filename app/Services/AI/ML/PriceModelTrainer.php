<?php

namespace App\Services\AI\ML;

use App\Models\AIModel;
use App\Models\AITrainingData;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * 落札単価の予測モデルを学習・評価・登録する（F-053 ML基礎フレームワーク）
 *
 * 1. データ準備: ai_training_data（F-051）から落札済み・検証済みの価格データを読む（自社の下支え入札・テストユーザーの落札は除外）
 * 2. 分割: 開催日順に並べ、直近の開催を「検証用」に取り分ける（未来の開催を当てられるかで評価する）
 * 3. 学習: 正則化の強さを候補から選び、リッジ回帰で log(落札単価) を学習
 * 4. 評価: 検証用データで誤差を測り、品種平均だけの予測（従来の統計方式）と比べる
 * 5. 登録: 全データで学び直したモデルを ai_models に保存。ベースラインより良ければ有効化
 */
class PriceModelTrainer
{
    public const MODEL_NAME = 'price';

    private const LAMBDA_CANDIDATES = [1.0, 3.0, 10.0, 30.0, 100.0, 300.0];

    private const MIN_SAMPLES = 30;

    /** 検証用に取り分ける件数の割合（直近の開催から順に、この割合に達するまで） */
    private const TEST_RATIO = 0.2;

    /** これ未満の落札しかない開催は、練習・デモとみなして使わない */
    private const MIN_AUCTION_SAMPLES = 10;

    /**
     * @return array{model: AIModel, metrics: array, activated: bool}
     */
    public function train(bool $forceActivate = false): array
    {
        $rows = $this->loadRows();
        if (count($rows) < self::MIN_SAMPLES) {
            throw new RuntimeException(sprintf('学習データが不足しています（%d 件 / 最低 %d 件）', count($rows), self::MIN_SAMPLES));
        }

        [$train, $test] = $this->splitByAuction($rows, self::TEST_RATIO);
        [$fitPart, $validPart] = $this->splitByAuction($train, 0.2);

        // 正則化の強さを選ぶ（学習用のうち直近の開催で比較）
        $bestLambda = self::LAMBDA_CANDIDATES[0];
        $bestMae = INF;
        foreach (self::LAMBDA_CANDIDATES as $lambda) {
            [$encoder, $model] = $this->fit($fitPart, $lambda);
            $mae = Metrics::mae($this->actual($validPart), $this->predictPrices($encoder, $model, $validPart));
            if ($mae < $bestMae) {
                $bestMae = $mae;
                $bestLambda = $lambda;
            }
        }

        // 検証用（直近の開催）で評価
        [$encoder, $model] = $this->fit($train, $bestLambda);
        $actual = $this->actual($test);
        $predicted = $this->predictPrices($encoder, $model, $test);
        $baseline = $this->baselinePredictions($train, $test);

        $logResiduals = [];
        foreach ($actual as $i => $a) {
            $logResiduals[] = log($a) - log(max(1.0, $predicted[$i]));
        }

        $metrics = [
            'mae_yen' => round(Metrics::mae($actual, $predicted)),
            'median_error_pct' => round(Metrics::medianApe($actual, $predicted), 1),
            'within_30pct_rate' => round(Metrics::withinRate($actual, $predicted), 1),
            'r2' => round(Metrics::r2(array_map('log', $actual), array_map(fn ($p) => log(max(1.0, $p)), $predicted)), 3),
            'baseline_mae_yen' => round(Metrics::mae($actual, $baseline)),
            'baseline_median_error_pct' => round(Metrics::medianApe($actual, $baseline), 1),
            'baseline_within_30pct_rate' => round(Metrics::withinRate($actual, $baseline), 1),
            'residual_std_log' => round(Metrics::std($logResiduals), 4),
            'lambda' => $bestLambda,
            'test_auctions' => array_values(array_unique(array_column($test, 'auction_id'))),
        ];
        $metrics['improvement_pct'] = $metrics['baseline_mae_yen'] > 0
            ? round(($metrics['baseline_mae_yen'] - $metrics['mae_yen']) / $metrics['baseline_mae_yen'] * 100, 1)
            : 0.0;

        // 本番用は全データで学び直す（評価値は上の検証結果を記録）
        [$finalEncoder, $finalModel] = $this->fit($rows, $bestLambda);
        $activate = $forceActivate || $metrics['mae_yen'] < $metrics['baseline_mae_yen'];

        $record = DB::transaction(function () use ($finalEncoder, $finalModel, $metrics, $train, $test, $rows, $activate, $bestLambda) {
            $version = (int) AIModel::where('name', self::MODEL_NAME)->lockForUpdate()->max('version') + 1;
            if ($activate) {
                AIModel::where('name', self::MODEL_NAME)->update(['is_active' => false]);
            }

            return AIModel::create([
                'name' => self::MODEL_NAME,
                'version' => $version,
                'algorithm' => $finalModel->algorithm(),
                'params' => ['lambda' => $bestLambda, 'target' => 'log(winning_price)', 'total_samples' => count($rows)],
                'metrics' => $metrics,
                'train_samples' => count($train),
                'test_samples' => count($test),
                'artifact' => ['encoder' => $finalEncoder->toArray(), 'estimator' => $finalModel->toArray()],
                'is_active' => $activate,
                'trained_at' => now(),
            ]);
        });

        return ['model' => $record, 'metrics' => $metrics, 'activated' => $activate];
    }

    /**
     * @return array<int, array> features に winning_price / auction_id / event_date を含む行
     */
    private function loadRows(): array
    {
        $houseBuyers = \App\Services\AI\AiDataScope::houseBuyerIds();
        $rows = [];

        AITrainingData::where('data_type', AITrainingData::TYPE_PRICE)
            ->where('is_validated', true)
            ->orderBy('id')
            ->chunkById(1000, function ($chunk) use (&$rows, $houseBuyers) {
                foreach ($chunk as $record) {
                    $labels = $record->labels ?? [];
                    $features = $record->features ?? [];
                    if (empty($labels['sold']) || (int) ($labels['winning_price'] ?? 0) <= 0) {
                        continue;
                    }
                    if (in_array((int) ($labels['winner_id'] ?? 0), $houseBuyers, true) || !empty($labels['winner_is_test'])) {
                        continue;
                    }
                    $rows[] = $features + [
                        'winning_price' => (int) $labels['winning_price'],
                        'item_id' => $record->item_id,
                    ];
                }
            });

        $perAuction = array_count_values(array_map(fn ($r) => (int) ($r['auction_id'] ?? 0), $rows));

        return array_values(array_filter($rows, fn ($r) => ($perAuction[(int) ($r['auction_id'] ?? 0)] ?? 0) >= self::MIN_AUCTION_SAMPLES));
    }

    /**
     * 開催日順に並べ、直近の開催から順に件数が全体の $ratio に達するまでを後ろ側に取り分ける。
     * 開催が少なすぎる場合は件数で分ける
     *
     * @return array{0: array, 1: array}
     */
    private function splitByAuction(array $rows, float $ratio): array
    {
        $auctions = [];
        $counts = [];
        foreach ($rows as $r) {
            $id = (int) ($r['auction_id'] ?? 0);
            $auctions[$id] ??= (string) ($r['event_date'] ?? '');
            $counts[$id] = ($counts[$id] ?? 0) + 1;
        }
        asort($auctions);
        $ids = array_keys($auctions);

        if (count($ids) >= 3) {
            $target = count($rows) * $ratio;
            $testIds = [];
            $taken = 0;
            foreach (array_reverse($ids) as $id) {
                if ($taken >= $target || count($testIds) >= count($ids) - 1) {
                    break;
                }
                $testIds[$id] = true;
                $taken += $counts[$id];
            }
            $head = array_values(array_filter($rows, fn ($r) => !isset($testIds[(int) ($r['auction_id'] ?? 0)])));
            $tail = array_values(array_filter($rows, fn ($r) => isset($testIds[(int) ($r['auction_id'] ?? 0)])));
            if (count($head) > 0 && count($tail) > 0) {
                return [$head, $tail];
            }
        }

        usort($rows, fn ($a, $b) => [$a['event_date'] ?? '', $a['item_id'] ?? 0] <=> [$b['event_date'] ?? '', $b['item_id'] ?? 0]);
        $cut = max(1, (int) floor(count($rows) * (1 - $ratio)));
        return [array_slice($rows, 0, $cut), array_slice($rows, $cut)];
    }

    /**
     * @return array{0: PriceFeatureEncoder, 1: RidgeRegression}
     */
    private function fit(array $rows, float $lambda): array
    {
        $encoder = new PriceFeatureEncoder();
        $encoder->fit($rows);
        $samples = array_map(fn ($r) => $encoder->transform($r), $rows);
        $targets = array_map(fn ($r) => log((float) $r['winning_price']), $rows);

        $model = new RidgeRegression($lambda, $encoder->dimensions());
        $model->fit($samples, $targets);

        return [$encoder, $model];
    }

    /** @return array<int, float> */
    private function predictPrices(PriceFeatureEncoder $encoder, Estimator $model, array $rows): array
    {
        return array_map(fn ($r) => exp($model->predict($encoder->transform($r))), $rows);
    }

    /** @return array<int, float> */
    private function actual(array $rows): array
    {
        return array_map(fn ($r) => (float) $r['winning_price'], $rows);
    }

    /**
     * ベースライン: 品種ごとの過去の落札単価の平均（対数平均）。未知の品種は全体平均
     *
     * @return array<int, float>
     */
    private function baselinePredictions(array $train, array $test): array
    {
        $sums = [];
        $all = [];
        foreach ($train as $r) {
            $key = PriceFeatureEncoder::normalizeSpecies($r['species_name'] ?? '');
            $log = log((float) $r['winning_price']);
            $sums[$key][] = $log;
            $all[] = $log;
        }
        $global = array_sum($all) / max(1, count($all));

        return array_map(function ($r) use ($sums, $global) {
            $key = PriceFeatureEncoder::normalizeSpecies($r['species_name'] ?? '');
            $logs = $sums[$key] ?? null;
            return exp($logs ? array_sum($logs) / count($logs) : $global);
        }, $test);
    }
}
