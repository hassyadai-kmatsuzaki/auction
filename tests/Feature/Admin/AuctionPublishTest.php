<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

class AuctionPublishTest extends TestCase
{
    public function test_admin_は_auction_を公開状態に切替できる(): void
    {
        $this->seedRoles();
        $admin = $this->createAdmin();
        $auction = Auction::factory()->finished()->unpublished()->create([
            'created_by' => $admin->id,
        ]);

        $response = $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/auctions/{$auction->id}/publish", ['is_published' => true]);

        $response->assertStatus(200)
            ->assertJsonPath('data.is_published', true);

        $auction->refresh();
        $this->assertTrue((bool) $auction->is_published);
        $this->assertNotNull($auction->published_at);
    }

    public function test_admin_は_auction_を非公開に戻せる(): void
    {
        $this->seedRoles();
        $admin = $this->createAdmin();
        $auction = Auction::factory()->finished()->create([
            'created_by' => $admin->id,
            'is_published' => true,
            'published_at' => now(),
        ]);

        $response = $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/auctions/{$auction->id}/publish", ['is_published' => false]);

        $response->assertStatus(200)
            ->assertJsonPath('data.is_published', false);

        $auction->refresh();
        $this->assertFalse((bool) $auction->is_published);
        $this->assertNull($auction->published_at);
    }

    public function test_is_published_が_false_の_auction_の_won_item_は参加者の一覧に出ない(): void
    {
        $this->seedRoles();
        $admin = $this->createAdmin();
        $auction = Auction::factory()->finished()->unpublished()->create([
            'created_by' => $admin->id,
        ]);

        $sellerProfile = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
        $item = Item::factory()->sold()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);

        $participant = $this->createParticipantWithSubscription();
        WonItem::factory()->create([
            'item_id' => $item->id,
            'winner_id' => $participant->id,
        ]);

        $response = $this->actingAs($participant, 'sanctum')
            ->getJson('/api/participant/won-items');

        $response->assertStatus(200);
        $this->assertSame(0, $response->json('data.summary.item_count'));
    }

    public function test_is_published_が_true_の_auction_の_won_item_は参加者の一覧に出る(): void
    {
        $this->seedRoles();
        $admin = $this->createAdmin();
        $auction = Auction::factory()->finished()->create([
            'created_by' => $admin->id,
            'is_published' => true,
            'published_at' => now(),
        ]);

        $sellerProfile = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
        $item = Item::factory()->sold()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);

        $participant = $this->createParticipantWithSubscription();
        WonItem::factory()->create([
            'item_id' => $item->id,
            'winner_id' => $participant->id,
        ]);

        $response = $this->actingAs($participant, 'sanctum')
            ->getJson('/api/participant/won-items');

        $response->assertStatus(200);
        $this->assertSame(1, $response->json('data.summary.item_count'));
    }
}
