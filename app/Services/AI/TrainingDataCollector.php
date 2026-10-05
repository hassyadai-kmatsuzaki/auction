<?php

namespace App\Services\AI;

use App\Models\AIImageAnalysis;
use App\Models\AIPricePrediction;
use App\Models\AITrainingData;
use App\Models\Item;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * AI 学習用データの蓄積（F-051）
 *
 * 終了済みオークションの出品・落札結果と、AI 画像解析の結果を ai_training_data に集める。
 * 入札・落札の処理経路には手を入れず、確定済みのデータを後から読み取って蓄積する（何度実行しても同じ結果になる）。
 */
class TrainingDataCollector
{
    private const CHUNK_SIZE = 500;

    /**
     * @return array{price: int, image: int, actual_price_updated: int}
     */
    public function collect(?int $auctionId = null): array
    {
        $price = 0;
        $actualPriceUpdated = 0;

        // 除外対象（練習・運用テスト）に指定された開催の蓄積済みデータは消す（後から除外指定した場合に備えて）
        $excluded = $this->excludedAuctionIds();
        if ($excluded) {
            AITrainingData::whereIn('item_id', Item::whereIn('auction_id', $excluded)->select('id'))->delete();
        }

        $this->settledItemsQuery($auctionId)->chunkById(self::CHUNK_SIZE, function (Collection $items) use (&$price, &$actualPriceUpdated) {
            $bidderCounts = DB::table('bid_events')
                ->whereIn('item_id', $items->pluck('id'))
                ->groupBy('item_id')
                ->selectRaw('item_id, COUNT(DISTINCT user_id) as bidder_count')
                ->pluck('bidder_count', 'item_id');

            foreach ($items as $item) {
                $this->storePriceRecord($item, (int) ($bidderCounts[$item->id] ?? 0));
                $price++;

                if ($item->wonItem) {
                    $actualPriceUpdated += AIPricePrediction::where('item_id', $item->id)
                        ->where(fn ($q) => $q->whereNull('actual_price')->orWhere('actual_price', '!=', (int) $item->wonItem->winning_price))
                        ->update(['actual_price' => (int) $item->wonItem->winning_price]);
                }
            }
        });

        $image = $this->collectImageRecords($auctionId);

        return ['price' => $price, 'image' => $image, 'actual_price_updated' => $actualPriceUpdated];
    }

    /**
     * 終了済み・テスト以外（除外指定の開催も除く）のオークションで、落札 or 流札が確定した生体
     */
    private function settledItemsQuery(?int $auctionId)
    {
        return Item::query()
            ->with(['auction:id,event_date,is_test,status', 'wonItem:id,item_id,winning_price,quantity,winner_id', 'wonItem.winner:id,is_test'])
            ->whereIn('status', ['sold', 'unsold'])
            ->whereHas('auction', fn ($q) => $q->where('status', 'finished')->where('is_test', false))
            ->whereNotIn('auction_id', $this->excludedAuctionIds() ?: [0])
            ->when($auctionId, fn ($q) => $q->where('auction_id', $auctionId));
    }

    /** @return int[] */
    private function excludedAuctionIds(): array
    {
        return AiDataScope::excludedAuctionIds();
    }

    private function storePriceRecord(Item $item, int $bidderCount): void
    {
        $eventDate = $item->auction?->event_date;
        $won = $item->wonItem;
        $sold = $item->status === 'sold' && $won !== null;
        $quantity = max(1, (int) ($won->quantity ?? $item->quantity ?? 1));

        AITrainingData::updateOrCreate(
            ['data_type' => AITrainingData::TYPE_PRICE, 'item_id' => $item->id],
            [
                'features' => [
                    'auction_id' => $item->auction_id,
                    'event_date' => $eventDate?->toDateString(),
                    'event_month' => $eventDate?->month,
                    'species_name' => $item->species_name,
                    'species_type_id' => $item->species_type_id,
                    'seller_profile_id' => $item->seller_profile_id,
                    'quantity' => (int) $item->quantity,
                    'quantity_unit' => $item->quantity_unit,
                    'start_price' => (int) $item->start_price,
                    'is_premium' => (bool) $item->is_premium,
                    'item_number' => $item->item_number,
                    'bidder_count' => $bidderCount,
                ],
                'labels' => [
                    'sold' => $sold,
                    // winning_price は1単位（匹・kg・袋）あたりの単価。請求額は単価×数量
                    'winning_price' => $sold ? (int) $won->winning_price : null,
                    'winning_total' => $sold ? (int) $won->winning_price * $quantity : null,
                    'winner_id' => $sold ? $won->winner_id : null,
                    // テストユーザーの落札は学習から除外する
                    'winner_is_test' => $sold ? (bool) $won->winner?->is_test : null,
                ],
                // 落札・流札の実績なので検証済み扱い
                'is_validated' => true,
            ],
        );
    }

    private function collectImageRecords(?int $auctionId): int
    {
        $count = 0;

        AIImageAnalysis::query()
            ->with(['item:id,auction_id,species_name,status', 'item.wonItem:id,item_id,winning_price', 'media:id,file_path,media_type'])
            ->when($auctionId, fn ($q) => $q->whereHas('item', fn ($i) => $i->where('auction_id', $auctionId)))
            ->whereHas('item', fn ($i) => $i->whereNotIn('auction_id', $this->excludedAuctionIds() ?: [0]))
            ->chunkById(self::CHUNK_SIZE, function (Collection $analyses) use (&$count) {
                foreach ($analyses as $analysis) {
                    if (!$analysis->item) {
                        continue;
                    }
                    $won = $analysis->item->wonItem;

                    AITrainingData::updateOrCreate(
                        ['data_type' => AITrainingData::TYPE_IMAGE, 'item_id' => $analysis->item_id],
                        [
                            'features' => [
                                'item_media_id' => $analysis->item_media_id,
                                'file_path' => $analysis->media?->file_path,
                                'media_type' => $analysis->media?->media_type,
                                'ai_model_version' => $analysis->model_version,
                                'ai_output' => [
                                    'body_shape' => $analysis->body_shape_features,
                                    'color' => $analysis->color_features,
                                    'pattern' => $analysis->pattern_features,
                                    'quality_score' => $analysis->quality_score !== null ? (float) $analysis->quality_score : null,
                                    'predicted_breed' => $analysis->predicted_breed,
                                    'breed_confidence' => $analysis->breed_confidence !== null ? (float) $analysis->breed_confidence : null,
                                ],
                            ],
                            'labels' => [
                                // 出品者申告の品種名（AI 推定の正解候補。人による確認前）
                                'species_name' => $analysis->item->species_name,
                                'sold' => $analysis->item->status === 'sold',
                                'winning_price' => $won ? (int) $won->winning_price : null,
                            ],
                            // 品種名は出品者申告のため、人の確認が済むまで未検証
                            'is_validated' => false,
                        ],
                    );
                    $count++;
                }
            });

        return $count;
    }
}
