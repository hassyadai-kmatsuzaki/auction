<?php

namespace Tests\Feature\AI;

use App\Models\AIModel;
use App\Models\AITrainingData;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Services\AI\ML\PriceModelTrainer;
use App\Services\AI\PricePredictionService;
use Illuminate\Support\Carbon;
use RuntimeException;
use Tests\TestCase;

class PriceModelTrainingTest extends TestCase
{
    private const SPECIES = ['紅白ラメ' => 3000, '楊貴妃' => 800, '幹之' => 1500];

    /**
     * 落札単価 = 品種の基準価格 × (開始価格 / 500)^0.5 × ノイズ という法則の人工データを作る。
     * 品種平均（従来方式）は開始価格の違いを拾えないので、学習モデルの方が誤差が小さくなるはず。
     */
    private function seedSyntheticData(int $auctions = 6, int $perSpecies = 6, array $houseWinnerIds = []): void
    {
        mt_srand(42);
        for ($a = 1; $a <= $auctions; $a++) {
            $date = Carbon::create(2026, 4, 1)->addWeeks($a * 2);
            foreach (self::SPECIES as $species => $base) {
                for ($k = 0; $k < $perSpecies; $k++) {
                    $start = [200, 500, 1000, 2000][($a + $k) % 4];
                    $price = (int) round($base * sqrt($start / 500) * (0.9 + mt_rand(0, 20) / 100));
                    AITrainingData::create([
                        'data_type' => 'price',
                        'item_id' => null,
                        'features' => [
                            'auction_id' => $a, 'event_date' => $date->toDateString(), 'event_month' => $date->month,
                            'species_name' => $species, 'species_type_id' => 1, 'seller_profile_id' => 10 + ($k % 3),
                            'quantity' => 10, 'quantity_unit' => 'fish', 'start_price' => $start, 'is_premium' => false,
                        ],
                        'labels' => ['sold' => true, 'winning_price' => $price, 'winner_id' => 1000 + $k],
                        'is_validated' => true,
                    ]);
                }
            }
        }
        foreach ($houseWinnerIds as $id) {
            AITrainingData::create([
                'data_type' => 'price', 'item_id' => null,
                'features' => ['auction_id' => 1, 'event_date' => '2026-04-15', 'species_name' => '紅白ラメ', 'start_price' => 100, 'quantity' => 10],
                'labels' => ['sold' => true, 'winning_price' => 100, 'winner_id' => $id],
                'is_validated' => true,
            ]);
        }
    }

    public function test_insufficient_data_throws(): void
    {
        $this->seedSyntheticData(auctions: 1, perSpecies: 3);

        $this->expectException(RuntimeException::class);
        app(PriceModelTrainer::class)->train();
    }

    public function test_trains_evaluates_and_activates_model_better_than_baseline(): void
    {
        $this->seedSyntheticData();

        $result = app(PriceModelTrainer::class)->train();
        $m = $result['metrics'];

        $this->assertTrue($result['activated']);
        $this->assertSame(1, $result['model']->version);
        $this->assertSame('ridge_regression', $result['model']->algorithm);
        $this->assertLessThan($m['baseline_mae_yen'], $m['mae_yen']);
        $this->assertGreaterThan(0, $m['improvement_pct']);
        // 全108件の2割（21.6件）に達するまで直近の開催から取り分ける → 第6回(18件)+第5回(18件)
        $this->assertSame([5, 6], $m['test_auctions'], '直近の開催を検証用に取り分ける');
        $this->assertSame(36, $result['model']->test_samples);
        $this->assertNotNull(AIModel::active('price'));
    }

    public function test_new_version_replaces_active_model(): void
    {
        $this->seedSyntheticData();

        app(PriceModelTrainer::class)->train();
        app(PriceModelTrainer::class)->train();

        $this->assertSame(2, AIModel::where('name', 'price')->count());
        $this->assertSame(1, AIModel::where('name', 'price')->where('is_active', true)->count());
        $this->assertSame(2, AIModel::active('price')->version);
    }

    public function test_house_buyer_wins_are_excluded(): void
    {
        config(['services.ai.house_buyer_ids' => [821]]);
        $this->seedSyntheticData(houseWinnerIds: [821, 821, 821]);

        $result = app(PriceModelTrainer::class)->train();

        $this->assertSame(108, $result['model']->params['total_samples']);
    }

    public function test_test_user_wins_are_excluded(): void
    {
        $this->seedSyntheticData();
        AITrainingData::create([
            'data_type' => 'price', 'item_id' => null,
            'features' => ['auction_id' => 1, 'event_date' => '2026-04-15', 'species_name' => '紅白ラメ', 'start_price' => 1000, 'quantity' => 10],
            'labels' => ['sold' => true, 'winning_price' => 47500, 'winner_id' => 5000, 'winner_is_test' => true],
            'is_validated' => true,
        ]);

        $result = app(PriceModelTrainer::class)->train();

        $this->assertSame(108, $result['model']->params['total_samples']);
    }

    public function test_price_prediction_uses_active_model(): void
    {
        $this->seedSyntheticData();
        $model = app(PriceModelTrainer::class)->train()['model'];

        $this->seedRoles();
        $admin = $this->createAdmin();
        $seller = $this->createSeller();
        $profile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $auction = Auction::factory()->scheduled()->create(['created_by' => $admin->id, 'event_date' => '2026-09-20']);
        $cheap = Item::factory()->create(['auction_id' => $auction->id, 'seller_profile_id' => $profile->id, 'species_name' => '紅白ラメ', 'start_price' => 200, 'quantity' => 10]);
        $pricey = Item::factory()->create(['auction_id' => $auction->id, 'seller_profile_id' => $profile->id, 'species_name' => '紅白ラメ', 'start_price' => 2000, 'quantity' => 10]);

        $p1 = app(PricePredictionService::class)->predictPrice($cheap);
        $p2 = app(PricePredictionService::class)->predictPrice($pricey);

        $this->assertSame($model->label(), $p1->model_version);
        $this->assertGreaterThan($p1->predicted_price, $p2->predicted_price, '開始価格が高いほど予測も高い');
        $this->assertLessThan($p1->predicted_price, $p1->price_low);
        $this->assertGreaterThan($p1->predicted_price, $p1->price_high);
        // 法則上の値（3000×√(200/500)≈1897）に近いこと
        $this->assertEqualsWithDelta(1897, $p1->predicted_price, 1897 * 0.2);
    }

    public function test_falls_back_to_statistics_without_active_model(): void
    {
        $this->seedRoles();
        $item = Item::factory()->create(['species_name' => '紅白ラメ', 'start_price' => 1000]);

        $p = app(PricePredictionService::class)->predictPrice($item);

        $this->assertSame('statistical_v1', $p->model_version);
    }

    public function test_command_prints_comparison(): void
    {
        $this->seedSyntheticData();

        $this->artisan('ai:train-price-model')
            ->expectsOutputToContain('モデル: ml-price-v1')
            ->expectsOutputToContain('このモデルを有効化しました')
            ->assertExitCode(0);
    }
}
