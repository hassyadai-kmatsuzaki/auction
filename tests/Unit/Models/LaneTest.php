<?php

namespace Tests\Unit\Models;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Models\User;
use Tests\TestCase;

class LaneTest extends TestCase
{
    protected User $admin;
    protected User $seller;
    protected SellerProfile $sellerProfile;
    protected Auction $auction;
    protected Lane $lane;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $this->seller->id]);

        $this->auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
        $this->lane = Lane::factory()->create([
            'auction_id' => $this->auction->id,
            'lane_number' => 1,
            'status' => 'waiting',
        ]);
    }

    public function test_lane_belongs_to_auction(): void
    {
        $this->assertInstanceOf(Auction::class, $this->lane->auction);
        $this->assertEquals($this->auction->id, $this->lane->auction->id);
    }

    public function test_lane_has_many_items(): void
    {
        $item = Item::factory()->registered()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $this->lane->items()->attach($item->id, ['sequence_order' => 1]);

        $this->assertCount(1, $this->lane->items);
        $this->assertEquals($item->id, $this->lane->items->first()->id);
    }

    public function test_lane_status_transitions(): void
    {
        $this->assertEquals('waiting', $this->lane->status);

        $this->lane->update(['status' => 'active']);
        $this->assertEquals('active', $this->lane->status);

        $this->lane->update(['status' => 'paused']);
        $this->assertEquals('paused', $this->lane->status);

        $this->lane->update(['status' => 'finished']);
        $this->assertEquals('finished', $this->lane->status);
    }

    public function test_lane_factory_creates_valid_lane(): void
    {
        $lane = Lane::factory()->create([
            'auction_id' => $this->auction->id,
            'lane_number' => 10, // ユニークな番号
        ]);

        $this->assertNotNull($lane->id);
        $this->assertNotNull($lane->lane_number);
        $this->assertContains($lane->status, ['waiting', 'active', 'paused', 'finished']);
    }

    public function test_lane_factory_states(): void
    {
        $waiting = Lane::factory()->waiting()->create([
            'auction_id' => $this->auction->id,
            'lane_number' => 2,
        ]);
        $this->assertEquals('waiting', $waiting->status);

        $active = Lane::factory()->active()->create([
            'auction_id' => $this->auction->id,
            'lane_number' => 3,
        ]);
        $this->assertEquals('active', $active->status);

        $paused = Lane::factory()->paused()->create([
            'auction_id' => $this->auction->id,
            'lane_number' => 4,
        ]);
        $this->assertEquals('paused', $paused->status);

        $finished = Lane::factory()->finished()->create([
            'auction_id' => $this->auction->id,
            'lane_number' => 5,
        ]);
        $this->assertEquals('finished', $finished->status);
    }
}
