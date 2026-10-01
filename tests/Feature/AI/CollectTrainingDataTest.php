<?php

namespace Tests\Feature\AI;

use App\Models\AIImageAnalysis;
use App\Models\AIPricePrediction;
use App\Models\AITrainingData;
use App\Models\Auction;
use App\Models\Item;
use App\Models\ItemMedia;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use App\Services\AI\TrainingDataCollector;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CollectTrainingDataTest extends TestCase
{
    private User $admin;
    private SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
    }

    private function makeAuction(array $overrides = []): Auction
    {
        return Auction::factory()->finished()->create(array_merge([
            'created_by' => $this->admin->id,
            'is_test' => false,
        ], $overrides));
    }

    private function makeItem(Auction $auction, string $status, array $overrides = []): Item
    {
        return Item::factory()->create(array_merge([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'status' => $status,
            'species_name' => '紅白ラメ',
            'quantity' => 10,
            'start_price' => 1000,
        ], $overrides));
    }

    private function win(Item $item, int $price): WonItem
    {
        return WonItem::factory()->create([
            'item_id' => $item->id,
            'winner_id' => $this->createParticipant()->id,
            'winning_price' => $price,
            'quantity' => $item->quantity,
        ]);
    }

    public function test_collects_sold_and_unsold_items_with_features_and_labels(): void
    {
        $auction = $this->makeAuction();
        $sold = $this->makeItem($auction, 'sold');
        $this->win($sold, 5000);
        $unsold = $this->makeItem($auction, 'unsold', ['species_name' => '楊貴妃']);

        $bidderA = $this->createParticipant();
        $bidderB = $this->createParticipant();
        foreach ([$bidderA, $bidderB, $bidderA] as $u) {
            DB::table('bid_events')->insert([
                'item_id' => $sold->id, 'user_id' => $u->id, 'event_type' => 'join',
                'price_at_event' => 1000, 'created_at' => now(),
            ]);
        }

        $result = app(TrainingDataCollector::class)->collect();

        $this->assertSame(2, $result['price']);

        $soldRow = AITrainingData::where('data_type', 'price')->where('item_id', $sold->id)->first();
        $this->assertSame('紅白ラメ', $soldRow->features['species_name']);
        $this->assertSame(10, $soldRow->features['quantity']);
        $this->assertSame(1000, $soldRow->features['start_price']);
        $this->assertSame(2, $soldRow->features['bidder_count']);
        $this->assertTrue($soldRow->labels['sold']);
        $this->assertSame(5000, $soldRow->labels['winning_price']);
        $this->assertSame(50000, $soldRow->labels['winning_total'], '単価×数量');
        $this->assertSame(WonItem::where('item_id', $sold->id)->value('winner_id'), $soldRow->labels['winner_id']);
        $this->assertTrue($soldRow->is_validated);

        $unsoldRow = AITrainingData::where('data_type', 'price')->where('item_id', $unsold->id)->first();
        $this->assertFalse($unsoldRow->labels['sold']);
        $this->assertNull($unsoldRow->labels['winning_price']);
    }

    public function test_is_idempotent(): void
    {
        $auction = $this->makeAuction();
        $this->win($this->makeItem($auction, 'sold'), 3000);

        app(TrainingDataCollector::class)->collect();
        app(TrainingDataCollector::class)->collect();

        $this->assertSame(1, AITrainingData::count());
    }

    public function test_excludes_test_auctions_unfinished_auctions_and_pending_items(): void
    {
        $this->win($this->makeItem($this->makeAuction(['is_test' => true]), 'sold'), 3000);
        $this->makeItem(Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]), 'registered');
        $this->makeItem($this->makeAuction(), 'cancelled');

        $result = app(TrainingDataCollector::class)->collect();

        $this->assertSame(0, $result['price']);
        $this->assertSame(0, AITrainingData::count());
    }

    public function test_excluded_auctions_are_skipped_and_previously_collected_rows_removed(): void
    {
        $practice = $this->makeAuction();
        $this->win($this->makeItem($practice, 'sold'), 3000);

        app(TrainingDataCollector::class)->collect();
        $this->assertSame(1, AITrainingData::count());

        config(['services.ai.excluded_auction_ids' => [$practice->id]]);
        $result = app(TrainingDataCollector::class)->collect();

        $this->assertSame(0, $result['price']);
        $this->assertSame(0, AITrainingData::count());
    }

    public function test_marks_test_user_wins(): void
    {
        $auction = $this->makeAuction();
        $item = $this->makeItem($auction, 'sold');
        $tester = $this->createParticipant();
        $tester->update(['is_test' => true]);
        WonItem::factory()->create(['item_id' => $item->id, 'winner_id' => $tester->id, 'winning_price' => 99999, 'quantity' => 10]);

        app(TrainingDataCollector::class)->collect();

        $this->assertTrue(AITrainingData::where('item_id', $item->id)->first()->labels['winner_is_test']);
    }

    public function test_fills_actual_price_on_price_predictions(): void
    {
        $auction = $this->makeAuction();
        $item = $this->makeItem($auction, 'sold');
        $this->win($item, 4200);
        AIPricePrediction::create([
            'item_id' => $item->id, 'species_name' => '紅白ラメ', 'predicted_price' => 4000,
            'price_low' => 3000, 'price_high' => 5000, 'confidence' => 60, 'factors' => [], 'model_version' => 'statistical_v1',
        ]);

        $result = app(TrainingDataCollector::class)->collect();

        $this->assertSame(1, $result['actual_price_updated']);
        $this->assertSame(4200, AIPricePrediction::where('item_id', $item->id)->value('actual_price'));
    }

    public function test_collects_image_analysis_as_unvalidated_image_data(): void
    {
        $auction = $this->makeAuction();
        $item = $this->makeItem($auction, 'sold');
        $this->win($item, 6000);
        $media = ItemMedia::create([
            'item_id' => $item->id, 'media_type' => 'photo_top', 'mime_type' => 'image/jpeg',
            'file_name' => 'a.jpg', 'file_size' => 100, 'file_path' => 'items/a.jpg', 'display_order' => 1,
        ]);
        AIImageAnalysis::create([
            'item_id' => $item->id, 'item_media_id' => $media->id, 'quality_score' => 8.5,
            'predicted_breed' => '紅白', 'breed_confidence' => 80, 'model_version' => 'gpt-4o-mini',
        ]);

        $result = app(TrainingDataCollector::class)->collect();

        $this->assertSame(1, $result['image']);
        $row = AITrainingData::where('data_type', 'image')->where('item_id', $item->id)->first();
        $this->assertSame('items/a.jpg', $row->features['file_path']);
        $this->assertSame(8.5, $row->features['ai_output']['quality_score']);
        $this->assertSame('紅白ラメ', $row->labels['species_name']);
        $this->assertSame(6000, $row->labels['winning_price']);
        $this->assertFalse($row->is_validated);
    }

    public function test_command_outputs_summary(): void
    {
        $this->win($this->makeItem($this->makeAuction(), 'sold'), 3000);

        $this->artisan('ai:collect-training-data')
            ->expectsOutputToContain('完了: 価格データ 1 件 / 画像データ 0 件 / 価格予測の実績反映 0 件')
            ->assertExitCode(0);
    }
}
