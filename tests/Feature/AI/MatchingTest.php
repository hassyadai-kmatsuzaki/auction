<?php

namespace Tests\Feature\AI;

use App\Models\AIRecommendation;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use App\Services\AI\MatchingService;
use App\Services\AI\RecommendationService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class MatchingTest extends TestCase
{
    private User $admin;
    private SellerProfile $sellerA;
    private SellerProfile $sellerB;
    private User $redFan;      // 紅白ラメをよく落札する人
    private User $yokihiFan;   // 楊貴妃をよく落札する人
    private User $house;       // 自社の下支えアカウント

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->sellerA = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
        $this->sellerB = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
        $this->redFan = $this->createParticipant();
        $this->yokihiFan = $this->createParticipant();
        $this->house = $this->createParticipant();
        config(['services.ai.house_buyer_ids' => [$this->house->id]]);
    }

    private function auction(string $date, string $status = 'finished', bool $isTest = false): Auction
    {
        return Auction::factory()->create([
            'created_by' => $this->admin->id, 'status' => $status, 'is_test' => $isTest, 'event_date' => $date,
        ]);
    }

    private function soldItem(Auction $auction, SellerProfile $seller, string $species, User $winner, int $price): Item
    {
        $item = Item::factory()->sold()->create([
            'auction_id' => $auction->id, 'seller_profile_id' => $seller->id, 'species_name' => $species, 'start_price' => 500,
        ]);
        WonItem::factory()->create(['item_id' => $item->id, 'winner_id' => $winner->id, 'winning_price' => $price, 'quantity' => 1]);
        return $item;
    }

    private function seedHistory(): void
    {
        foreach (['2026-06-01', '2026-07-01', '2026-08-01'] as $date) {
            $a = $this->auction($date);
            $this->soldItem($a, $this->sellerA, '紅白ラメ (A)', $this->redFan, 3000);
            $this->soldItem($a, $this->sellerA, '紅白ラメ', $this->redFan, 3200);
            $this->soldItem($a, $this->sellerB, '楊貴妃', $this->yokihiFan, 800);
            $this->soldItem($a, $this->sellerB, '紅白ラメ', $this->house, 500); // 自社アカウントの落札は無視されるべき
        }
    }

    public function test_ranks_buyers_by_species_seller_and_price_affinity(): void
    {
        $this->seedHistory();
        $upcoming = Item::factory()->registered()->create([
            'auction_id' => $this->auction('2026-10-10', 'scheduled')->id,
            'seller_profile_id' => $this->sellerA->id, 'species_name' => '紅白ラメ', 'start_price' => 500,
        ]);

        $buyers = app(MatchingService::class)->matchBuyersForItem($upcoming, 10, null, 3000);

        $this->assertSame($this->redFan->id, $buyers[0]['user_id']);
        $this->assertNotContains($this->house->id, array_column($buyers, 'user_id'), '自社アカウントは除外');
        $this->assertNotContains($this->yokihiFan->id, array_column($buyers, 'user_id'), '品種にも出品者にも接点が無い人は候補外');
        $this->assertSame(6, $buyers[0]['wins']);
        $this->assertContains('この出品者の生体を好む', $buyers[0]['reasons']);
    }

    public function test_bids_favorites_and_limits_count_as_interest(): void
    {
        $this->seedHistory();
        $newcomer = $this->createParticipant();
        $past = Item::where('species_name', '楊貴妃')->first();
        DB::table('bid_events')->insert(['item_id' => $past->id, 'user_id' => $newcomer->id, 'event_type' => 'join', 'price_at_event' => 800, 'created_at' => now()]);
        DB::table('favorites')->insert(['item_id' => $past->id, 'user_id' => $newcomer->id, 'created_at' => now(), 'updated_at' => now()]);

        $upcoming = Item::factory()->registered()->create([
            'auction_id' => $this->auction('2026-10-10', 'scheduled')->id,
            'seller_profile_id' => $this->sellerA->id, 'species_name' => '楊貴妃', 'start_price' => 700,
        ]);

        $ids = array_column(app(MatchingService::class)->matchBuyersForItem($upcoming), 'user_id');

        $this->assertContains($newcomer->id, $ids);
        $this->assertContains($this->yokihiFan->id, $ids);
    }

    public function test_ignores_test_auctions_and_test_users(): void
    {
        $testUser = $this->createParticipant();
        $testUser->update(['is_test' => true]);
        $this->soldItem($this->auction('2026-06-01'), $this->sellerA, '三色', $testUser, 2000);
        $this->soldItem($this->auction('2026-06-08', 'finished', true), $this->sellerA, '三色', $this->redFan, 2000);

        $upcoming = Item::factory()->registered()->create([
            'auction_id' => $this->auction('2026-10-10', 'scheduled')->id,
            'seller_profile_id' => $this->sellerB->id, 'species_name' => '三色', 'start_price' => 500,
        ]);

        $this->assertSame([], app(MatchingService::class)->matchBuyersForItem($upcoming));
    }

    public function test_excluded_auctions_are_ignored(): void
    {
        $practice = $this->auction('2026-06-01');
        $this->soldItem($practice, $this->sellerA, '三色', $this->redFan, 2000);
        config(['services.ai.excluded_auction_ids' => [$practice->id]]);

        $upcoming = Item::factory()->registered()->create([
            'auction_id' => $this->auction('2026-10-10', 'scheduled')->id,
            'seller_profile_id' => $this->sellerB->id, 'species_name' => '三色', 'start_price' => 500,
        ]);

        $this->assertSame([], app(MatchingService::class)->matchBuyersForItem($upcoming));
    }

    public function test_evaluate_backtests_on_recent_auctions(): void
    {
        $this->seedHistory();
        // 直近の開催: 履歴どおり紅白ラメ好きが紅白ラメを、楊貴妃好きが楊貴妃を落札
        $latest = $this->auction('2026-09-01');
        for ($i = 0; $i < 5; $i++) {
            $this->soldItem($latest, $this->sellerA, '紅白ラメ', $this->redFan, 3100);
            $this->soldItem($latest, $this->sellerB, '楊貴妃', $this->yokihiFan, 900);
        }
        // 練習規模（落札10件未満）の開催は検証から外れる
        $practice = $this->auction('2026-09-20');
        $this->soldItem($practice, $this->sellerA, '練習', $this->yokihiFan, 100);

        $r = app(MatchingService::class)->evaluate(1);

        $this->assertSame(1, $r['auctions']);
        $this->assertSame(10, $r['items']);
        $this->assertSame(100.0, $r['hit_rate_at_10']);
        $this->assertSame(100.0, $r['coverage']);
    }

    public function test_recommendations_include_matching_source(): void
    {
        $this->seedHistory();
        Item::factory()->registered()->create([
            'auction_id' => $this->auction('2026-10-10', 'scheduled')->id,
            'seller_profile_id' => $this->sellerA->id, 'species_name' => '紅白ラメ', 'start_price' => 500,
        ]);

        $recs = app(RecommendationService::class)->generateRecommendations($this->redFan);

        $this->assertContains('matching', array_column($recs, 'source'));
        $this->assertTrue(AIRecommendation::where('user_id', $this->redFan->id)->where('source', 'matching')->exists());
    }

    public function test_buyers_endpoint_and_command(): void
    {
        $this->seedHistory();
        $upcoming = Item::factory()->registered()->create([
            'auction_id' => $this->auction('2026-10-10', 'scheduled')->id,
            'seller_profile_id' => $this->sellerA->id, 'species_name' => '紅白ラメ', 'start_price' => 500,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/ai/matching/items/{$upcoming->id}/buyers")
            ->assertOk()
            ->assertJsonPath('data.item.expected_price_source', 'start_price')
            ->assertJsonPath('data.buyers.0.user_id', $this->redFan->id);

        $this->actingAs($this->createParticipant(), 'sanctum')
            ->getJson("/api/admin/ai/matching/items/{$upcoming->id}/buyers")
            ->assertStatus(403);

        $this->artisan('ai:evaluate-matching', ['--auctions' => 1])
            ->expectsOutputToContain('実際の落札者が上位10人に入った割合')
            ->assertExitCode(0);
    }
}
