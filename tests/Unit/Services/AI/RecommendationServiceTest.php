<?php

namespace Tests\Unit\Services\AI;

use App\Models\AIRecommendation;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use App\Services\AI\RecommendationService;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class RecommendationServiceTest extends TestCase
{
    private RecommendationService $service;
    private SellerProfile $sellerProfile;
    private Auction $auction;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->service = new RecommendationService();

        $admin = $this->createAdmin();
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $this->auction = Auction::factory()->scheduled()->create(['created_by' => $admin->id]);
        $this->user = $this->createParticipant();
    }

    private function makeItem(array $overrides = []): Item
    {
        return Item::factory()->registered()->create(array_merge([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ], $overrides));
    }

    public function test_generateRecommendations_returns_empty_when_no_history(): void
    {
        $result = $this->service->generateRecommendations($this->user, 10);
        $this->assertSame([], $result);
    }

    public function test_generateRecommendations_returns_trending_items_based_on_recent_favorites(): void
    {
        $item = $this->makeItem(['species_name' => '幹之メダカ']);
        $other = $this->createParticipant();

        DB::table('favorites')->insert([
            'user_id' => $other->id,
            'item_id' => $item->id,
            'created_at' => now()->subDay(),
            'updated_at' => now()->subDay(),
        ]);

        $result = $this->service->generateRecommendations($this->user, 10);

        $this->assertNotEmpty($result);
        $this->assertSame($item->id, $result[0]['item_id']);
        $this->assertDatabaseHas('ai_recommendations', [
            'user_id' => $this->user->id,
            'item_id' => $item->id,
        ]);
    }

    public function test_generateRecommendations_recommends_via_content_based_from_favorites(): void
    {
        // ユーザーがお気に入り登録済みの商品
        $favItem = $this->makeItem(['species_name' => '楊貴妃メダカ']);
        DB::table('favorites')->insert([
            'user_id' => $this->user->id,
            'item_id' => $favItem->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 同じ品種の別商品（推薦対象）
        $newItem = $this->makeItem(['species_name' => '楊貴妃メダカ']);

        $result = $this->service->generateRecommendations($this->user, 10);

        $itemIds = array_column($result, 'item_id');
        $this->assertContains($newItem->id, $itemIds);
    }

    public function test_generateRecommendations_content_based_excludes_user_favorited_items(): void
    {
        $favItem = $this->makeItem(['species_name' => '楊貴妃メダカ']);
        DB::table('favorites')->insert([
            'user_id' => $this->user->id,
            'item_id' => $favItem->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 同品種の別商品（コンテンツベースで推薦されるはず）
        $newItem = $this->makeItem(['species_name' => '楊貴妃メダカ']);

        $result = $this->service->generateRecommendations($this->user, 10);
        $contentBased = array_filter($result, fn ($r) => $r['source'] === 'content_based');
        $contentBasedIds = array_column($contentBased, 'item_id');

        // コンテンツベース推薦には自分のお気に入りは含まれない
        $this->assertNotContains($favItem->id, $contentBasedIds);
        $this->assertContains($newItem->id, $contentBasedIds);
    }

    public function test_generateRecommendations_respects_limit(): void
    {
        $other = $this->createParticipant();
        $items = [];
        for ($i = 0; $i < 5; $i++) {
            $items[] = $this->makeItem(['species_name' => "種類{$i}"]);
        }
        foreach ($items as $item) {
            DB::table('favorites')->insert([
                'user_id' => $other->id,
                'item_id' => $item->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $result = $this->service->generateRecommendations($this->user, 3);
        $this->assertLessThanOrEqual(3, count($result));
    }

    public function test_getForUser_returns_user_recommendations_ordered_by_score(): void
    {
        $itemA = $this->makeItem();
        $itemB = $this->makeItem();

        AIRecommendation::create([
            'user_id' => $this->user->id,
            'item_id' => $itemA->id,
            'score' => 0.5,
            'reason' => 'a',
            'source' => 'trending',
        ]);
        AIRecommendation::create([
            'user_id' => $this->user->id,
            'item_id' => $itemB->id,
            'score' => 0.9,
            'reason' => 'b',
            'source' => 'trending',
        ]);

        $result = $this->service->getForUser($this->user->id);

        $this->assertCount(2, $result);
        $this->assertSame($itemB->id, $result->first()->item_id);
    }
}
