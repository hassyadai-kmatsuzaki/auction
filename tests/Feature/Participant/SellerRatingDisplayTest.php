<?php

namespace Tests\Feature\Participant;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\WonItem;
use Tests\TestCase;

/**
 * F-023 落札者マイページの出品者評価表示
 */
class SellerRatingDisplayTest extends TestCase
{
    public function test_seller_rating_is_shown_only_when_feature_on_and_not_anonymous(): void
    {
        $this->seedRoles();
        $buyer = $this->createParticipant();
        $seller = $this->createSeller();
        $seller->forceFill(['trust_score' => 0.96, 'review_count' => 12])->save();
        $profile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $auction = Auction::factory()->finished()->create();
        foreach ([false, true] as $anonymous) {
            $item = Item::factory()->create(['auction_id' => $auction->id, 'seller_profile_id' => $profile->id, 'is_anonymous' => $anonymous]);
            WonItem::factory()->create(['item_id' => $item->id, 'winner_id' => $buyer->id]);
        }
        $get = fn () => collect($this->actingAs($buyer, 'sanctum')->getJson('/api/participant/won-items')->assertOk()->json('data.auctions.0.won_items'))
            ->pluck('item.seller_rating', 'item.seller_name');

        $this->assertNull($get()->first());

        config(['features.seller_rating' => true]);
        $ratings = $get();
        $this->assertSame(['average' => 4.8, 'count' => 12], $ratings->first(fn ($v, $k) => $k !== '匿名出品'));
        $this->assertNull($ratings->get('匿名出品'));
    }
}
