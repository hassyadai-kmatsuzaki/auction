<?php

namespace Tests\Unit;

use App\Models\Item;
use App\Models\Auction;
use App\Models\WonItem;
use App\Models\SellerProfile;
use App\Models\User;
use App\Services\AI\PricePredictionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PricePredictionServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_predict_price_with_insufficient_data(): void
    {
        $auction = Auction::factory()->create();
        $item = Item::factory()->create([
            'auction_id' => $auction->id,
            'species_name' => '幹之メダカ',
            'start_price' => 1000,
        ]);

        $service = new PricePredictionService();
        $prediction = $service->predictPrice($item);

        $this->assertEquals(1500, $prediction->predicted_price);
        $this->assertEquals(10, $prediction->confidence);
    }

    public function test_predict_price_with_historical_data(): void
    {
        $auction = Auction::factory()->create();
        $item = Item::factory()->create([
            'auction_id' => $auction->id,
            'species_name' => '楊貴妃メダカ',
            'start_price' => 500,
        ]);

        // 過去の取引データを作成
        for ($i = 0; $i < 5; $i++) {
            $otherAuction = Auction::factory()->create();
            $otherItem = Item::factory()->create([
                'auction_id' => $otherAuction->id,
                'species_name' => '楊貴妃メダカ',
            ]);
            WonItem::factory()->create([
                'item_id' => $otherItem->id,
                'winning_price' => 2000 + ($i * 100),
                'payment_status' => 'paid',
            ]);
        }

        $service = new PricePredictionService();
        $prediction = $service->predictPrice($item);

        $this->assertGreaterThan(10, $prediction->confidence);
        $this->assertGreaterThan(0, $prediction->predicted_price);
    }

    public function test_market_trends(): void
    {
        $service = new PricePredictionService();
        $trends = $service->getMarketTrends();

        $this->assertIsArray($trends);
    }
}
