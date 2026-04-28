<?php

namespace Tests\Feature\Participant;

use App\Models\Auction;
use App\Models\Favorite;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use Tests\TestCase;

class FavoriteTest extends TestCase
{
    protected User $participant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->participant = $this->createParticipant();
    }

    /**
     * 共通: 進行中オークション + アイテムを返す
     */
    private function makeItem(array $overrides = []): Item
    {
        $auction = Auction::factory()->create([
            'event_date' => now()->addDay(),
            'status' => 'scheduled',
        ]);
        $seller = SellerProfile::factory()->create();
        return Item::factory()->create(array_merge([
            'auction_id' => $auction->id,
            'seller_profile_id' => $seller->id,
            'status' => 'registered',
        ], $overrides));
    }

    public function test_unauthenticated_user_cannot_access_favorites(): void
    {
        $this->getJson('/api/participant/favorites')->assertStatus(401);
        $this->postJson('/api/participant/favorites/toggle', ['item_id' => 1])->assertStatus(401);
        $this->postJson('/api/participant/favorites/check', ['item_ids' => [1]])->assertStatus(401);
    }

    public function test_seller_cannot_access_participant_favorites(): void
    {
        $seller = $this->createSeller();
        $this->actingAs($seller, 'sanctum')
            ->getJson('/api/participant/favorites')
            ->assertStatus(403);
    }

    public function test_index_returns_only_own_favorites(): void
    {
        $itemA = $this->makeItem();
        $itemB = $this->makeItem();
        $other = $this->createParticipant();

        Favorite::create(['user_id' => $this->participant->id, 'item_id' => $itemA->id]);
        Favorite::create(['user_id' => $other->id,             'item_id' => $itemB->id]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/participant/favorites');

        $response->assertOk()->assertJsonPath('success', true);
        $favorites = $response->json('data.favorites');
        $this->assertCount(1, $favorites);
        $this->assertSame($itemA->id, $favorites[0]['item_id']);
    }

    public function test_index_excludes_past_auctions_by_default(): void
    {
        $futureItem = $this->makeItem();

        $pastAuction = Auction::factory()->create([
            'event_date' => now()->subDays(3),
            'status' => 'finished',
        ]);
        $seller = SellerProfile::factory()->create();
        $pastItem = Item::factory()->create([
            'auction_id' => $pastAuction->id,
            'seller_profile_id' => $seller->id,
            'status' => 'sold',
        ]);

        Favorite::create(['user_id' => $this->participant->id, 'item_id' => $futureItem->id]);
        Favorite::create(['user_id' => $this->participant->id, 'item_id' => $pastItem->id]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/participant/favorites');
        $response->assertOk();
        $favorites = $response->json('data.favorites');
        $this->assertCount(1, $favorites);
        $this->assertSame($futureItem->id, $favorites[0]['item_id']);

        // include_past=true なら過去も含む
        $responseAll = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/participant/favorites?include_past=1');
        $responseAll->assertOk();
        $this->assertCount(2, $responseAll->json('data.favorites'));
    }

    public function test_toggle_adds_favorite_when_absent(): void
    {
        $item = $this->makeItem();

        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/favorites/toggle', ['item_id' => $item->id]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('is_favorited', true);

        $this->assertDatabaseHas('favorites', [
            'user_id' => $this->participant->id,
            'item_id' => $item->id,
        ]);
    }

    public function test_toggle_removes_favorite_when_present(): void
    {
        $item = $this->makeItem();
        Favorite::create(['user_id' => $this->participant->id, 'item_id' => $item->id]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/favorites/toggle', ['item_id' => $item->id]);

        $response->assertOk()
            ->assertJsonPath('is_favorited', false);

        $this->assertDatabaseMissing('favorites', [
            'user_id' => $this->participant->id,
            'item_id' => $item->id,
        ]);
    }

    public function test_toggle_validates_item_exists(): void
    {
        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/favorites/toggle', ['item_id' => 99999999]);
        $response->assertStatus(422);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/favorites/toggle', []);
        $response->assertStatus(422);
    }

    public function test_check_bulk_returns_only_users_favorited_ids(): void
    {
        $item1 = $this->makeItem();
        $item2 = $this->makeItem();
        $item3 = $this->makeItem();
        $other = $this->createParticipant();

        Favorite::create(['user_id' => $this->participant->id, 'item_id' => $item1->id]);
        Favorite::create(['user_id' => $this->participant->id, 'item_id' => $item3->id]);
        // 他ユーザのお気に入りは混入しない
        Favorite::create(['user_id' => $other->id, 'item_id' => $item2->id]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/favorites/check', [
                'item_ids' => [$item1->id, $item2->id, $item3->id],
            ]);

        $response->assertOk()->assertJsonPath('success', true);
        $ids = $response->json('data.favorite_item_ids');
        sort($ids);
        $this->assertSame([$item1->id, $item3->id], $ids);
    }

    public function test_check_bulk_validates_payload(): void
    {
        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/favorites/check', [])
            ->assertStatus(422);

        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/favorites/check', ['item_ids' => 'not-array'])
            ->assertStatus(422);
    }

    public function test_toggle_does_not_affect_other_users_favorites(): void
    {
        $item = $this->makeItem();
        $other = $this->createParticipant();
        Favorite::create(['user_id' => $other->id, 'item_id' => $item->id]);

        // 自分でトグル → 自分の Favorite が新規作成され、他人のは残る
        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/favorites/toggle', ['item_id' => $item->id])
            ->assertOk()
            ->assertJsonPath('is_favorited', true);

        $this->assertDatabaseHas('favorites', [
            'user_id' => $this->participant->id,
            'item_id' => $item->id,
        ]);
        $this->assertDatabaseHas('favorites', [
            'user_id' => $other->id,
            'item_id' => $item->id,
        ]);
    }
}
