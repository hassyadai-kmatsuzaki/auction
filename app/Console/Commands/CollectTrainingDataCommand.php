<?php

namespace App\Console\Commands;

use App\Services\AI\TrainingDataCollector;
use Illuminate\Console\Command;

class CollectTrainingDataCommand extends Command
{
    protected $signature = 'ai:collect-training-data {--auction= : 対象オークションID（省略時は終了済み全件）}';
    protected $description = 'AI 学習用データ（落札実績・画像解析結果）を ai_training_data に蓄積（F-051）';

    public function handle(TrainingDataCollector $collector): int
    {
        $auctionId = $this->option('auction') ? (int) $this->option('auction') : null;

        $result = $collector->collect($auctionId);

        $this->info(sprintf(
            '完了: 価格データ %d 件 / 画像データ %d 件 / 価格予測の実績反映 %d 件',
            $result['price'],
            $result['image'],
            $result['actual_price_updated'],
        ));

        return self::SUCCESS;
    }
}
