<?php

namespace App\Console\Commands;

use App\Services\AI\ML\PriceModelTrainer;
use Illuminate\Console\Command;
use RuntimeException;

class TrainPriceModelCommand extends Command
{
    protected $signature = 'ai:train-price-model {--force-activate : ベースラインより悪くても有効化する}';
    protected $description = '学習用データから落札単価の予測モデルを学習・評価し、登録する（F-053）';

    public function handle(PriceModelTrainer $trainer): int
    {
        try {
            $result = $trainer->train((bool) $this->option('force-activate'));
        } catch (RuntimeException $e) {
            $this->warn($e->getMessage());
            return self::SUCCESS;
        }

        $m = $result['metrics'];
        $model = $result['model'];

        $this->info("モデル: {$model->label()}（{$model->algorithm}・学習 {$model->train_samples} 件 / 検証 {$model->test_samples} 件）");
        $this->table(
            ['指標（検証用＝直近の開催）', '機械学習モデル', '品種平均（従来方式）'],
            [
                ['平均誤差（円）', number_format($m['mae_yen']), number_format($m['baseline_mae_yen'])],
                ['誤差率の中央値', "{$m['median_error_pct']}%", "{$m['baseline_median_error_pct']}%"],
                ['±30%以内に入った割合', "{$m['within_30pct_rate']}%", "{$m['baseline_within_30pct_rate']}%"],
            ],
        );
        $this->info("改善率（平均誤差）: {$m['improvement_pct']}% / 決定係数(対数): {$m['r2']} / 正則化: {$m['lambda']}");
        $this->info($result['activated'] ? 'このモデルを有効化しました（価格予測に使用されます）' : '従来方式より良くないため有効化しませんでした');

        return self::SUCCESS;
    }
}
