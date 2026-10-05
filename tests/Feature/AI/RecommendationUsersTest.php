<?php

namespace Tests\Feature\AI;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use App\Services\AI\RecommendationService;
use Tests\TestCase;

class RecommendationUsersTest extends TestCase
{
    private User $admin;
    private SellerProfile $seller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->seller = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
    }

    private function win(User $user, int $times, bool $testAuction = false, string $species = '紅白ラメ'): void
    {
        $auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id, 'is_test' => $testAuction, 'event_date' => '2026-09-11']);
        for ($i = 0; $i < $times; $i++) {
            $item = Item::factory()->sold()->create(['auction_id' => $auction->id, 'seller_profile_id' => $this->seller->id, 'species_name' => $species]);
            WonItem::factory()->create(['item_id' => $item->id, 'winner_id' => $user->id, 'winning_price' => 1000, 'quantity' => 1]);
        }
    }

    public function test_users_are_ordered_by_real_wins(): void
    {
        $heavy = $this->createParticipant();
        $light = $this->createParticipant();
        $none = $this->createParticipant();
        $testOnly = $this->createParticipant();
        $tester = $this->createParticipant();
        $tester->update(['is_test' => true]);
        $house = $this->createParticipant();
        config(['services.ai.house_buyer_ids' => [$house->id]]);

        $this->win($heavy, 5);
        $this->win($light, 2);
        $this->win($testOnly, 9, testAuction: true); // テスト開催の落札は実績に数えない
        $this->win($tester, 9);
        $this->win($house, 9);

        $res = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/ai/recommendation-users')
            ->assertOk()
            ->assertJsonPath('data.with_wins', 2);

        $users = collect($res->json('data.users'));
        $this->assertSame([$heavy->id, $light->id], $users->take(2)->pluck('id')->all());
        $this->assertSame([5, 2], $users->take(2)->pluck('wins')->all());
        $this->assertSame(0, $users->firstWhere('id', $testOnly->id)['wins']);
        $this->assertContains($none->id, $users->pluck('id')->all());
        $this->assertNotContains($tester->id, $users->pluck('id')->all(), 'テストユーザーは出さない');
        $this->assertNotContains($house->id, $users->pluck('id')->all(), '下支えアカウントは出さない');
    }

    public function test_user_with_wins_gets_recommendations_and_test_auction_items_are_never_recommended(): void
    {
        $buyer = $this->createParticipant();
        $this->win($buyer, 3);

        $upcoming = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id, 'is_test' => false]);
        $testUpcoming = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id, 'is_test' => true]);
        $real = Item::factory()->registered()->create(['auction_id' => $upcoming->id, 'seller_profile_id' => $this->seller->id, 'species_name' => '紅白ラメ']);
        $test = Item::factory()->registered()->create(['auction_id' => $testUpcoming->id, 'seller_profile_id' => $this->seller->id, 'species_name' => '紅白ラメ']);

        $ids = array_column(app(RecommendationService::class)->generateRecommendations($buyer), 'item_id');

        $this->assertContains($real->id, $ids);
        $this->assertNotContains($test->id, $ids);
    }

    public function test_requires_admin(): void
    {
        $this->actingAs($this->createParticipant(), 'sanctum')
            ->getJson('/api/admin/ai/recommendation-users')
            ->assertStatus(403);
    }
}
