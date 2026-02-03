<?php

namespace Tests\Unit\Models;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use Tests\TestCase;

class ItemTest extends TestCase
{
    protected User $admin;
    protected Auction $auction;
    protected SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->auction = Auction::factory()->create(['created_by' => $this->admin->id]);
        
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
    }

    public function test_item_can_be_created(): void
    {
        $item = Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $this->assertDatabaseHas('items', [
            'id' => $item->id,
        ]);
    }

    public function test_item_belongs_to_auction(): void
    {
        $item = Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $this->assertInstanceOf(Auction::class, $item->auction);
        $this->assertEquals($this->auction->id, $item->auction->id);
    }

    public function test_item_belongs_to_seller_profile(): void
    {
        $item = Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $this->assertInstanceOf(SellerProfile::class, $item->sellerProfile);
        $this->assertEquals($this->sellerProfile->id, $item->sellerProfile->id);
    }

    public function test_item_has_media_relationship(): void
    {
        $item = Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $this->assertInstanceOf(\Illuminate\Database\Eloquent\Collection::class, $item->media);
    }

    public function test_draft_item_can_be_created(): void
    {
        $item = Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $this->assertEquals('draft', $item->status);
    }

    public function test_registered_item_can_be_created(): void
    {
        $item = Item::factory()->registered()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $this->assertEquals('registered', $item->status);
    }

    public function test_sold_item_can_be_created(): void
    {
        $item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $this->assertEquals('sold', $item->status);
    }

    public function test_premium_item_can_be_created(): void
    {
        $item = Item::factory()->premium()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $this->assertTrue($item->is_premium);
    }

    public function test_item_number_is_assigned(): void
    {
        $item = Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $this->assertNotNull($item->item_number);
    }

    public function test_current_price_equals_start_price_initially(): void
    {
        $item = Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'start_price' => 30000,
            'current_price' => 30000,
        ]);

        $this->assertEquals($item->start_price, $item->current_price);
    }
}
