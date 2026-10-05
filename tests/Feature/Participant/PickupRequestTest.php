<?php

namespace Tests\Feature\Participant;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

/**
 * F-038 落札者の「会場で受け取る」希望（送料・請求は変えない）
 */
class PickupRequestTest extends TestCase
{
    private User $buyer;
    private Auction $auction;
    private WonItem $w1;
    private WonItem $w2;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        config(['features.pickup_request' => true]);
        $this->buyer = $this->createParticipant();
        $this->auction = Auction::factory()->finished()->create();
        $profile = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
        [$this->w1, $this->w2] = collect([1, 2])->map(fn () => WonItem::factory()->create([
            'item_id' => Item::factory()->create(['auction_id' => $this->auction->id, 'seller_profile_id' => $profile->id])->id,
            'winner_id' => $this->buyer->id,
            'delivery_method' => 'shipping',
            'delivery_status' => 'pending',
            'shipping_fee' => 1500,
            'shipping_locked_at' => null,
        ]))->all();
    }

    private function request(string $method)
    {
        return $this->actingAs($this->buyer, 'sanctum')->putJson("/api/participant/auctions/{$this->auction->id}/delivery-method", ['delivery_method' => $method]);
    }

    public function test_pickup_request_updates_all_items_of_auction_without_touching_fees(): void
    {
        $this->request('pickup')->assertOk();

        foreach ([$this->w1, $this->w2] as $w) {
            $w->refresh();
            $this->assertSame('pickup', $w->delivery_method);
            $this->assertSame(1500, (int) $w->shipping_fee);
        }
        $this->actingAs($this->buyer, 'sanctum')->getJson('/api/participant/won-items')
            ->assertJsonPath('data.auctions.0.shipping.delivery_method', 'pickup');

        $this->request('shipping')->assertOk();
        $this->assertSame('shipping', $this->w1->fresh()->delivery_method);
    }

    public function test_cannot_change_after_shipping_is_locked(): void
    {
        $this->w2->update(['shipping_locked_at' => now()]);

        $this->request('pickup')->assertStatus(422);
        $this->assertSame('shipping', $this->w1->fresh()->delivery_method);
    }

    public function test_feature_off_is_404_and_field_hidden(): void
    {
        config(['features.pickup_request' => false]);

        $this->request('pickup')->assertStatus(404);
        $this->actingAs($this->buyer, 'sanctum')->getJson('/api/participant/won-items')
            ->assertJsonMissingPath('data.auctions.0.shipping.delivery_method');
    }
}
