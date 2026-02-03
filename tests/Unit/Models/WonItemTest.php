<?php

namespace Tests\Unit\Models;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

class WonItemTest extends TestCase
{
    protected User $admin;
    protected User $participant;
    protected Item $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->participant = $this->createParticipant();
        
        $auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        
        $this->item = Item::factory()->sold()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);
    }

    public function test_won_item_can_be_created(): void
    {
        $wonItem = WonItem::factory()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
        ]);

        $this->assertDatabaseHas('won_items', [
            'id' => $wonItem->id,
        ]);
    }

    public function test_won_item_belongs_to_item(): void
    {
        $wonItem = WonItem::factory()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
        ]);

        $this->assertInstanceOf(Item::class, $wonItem->item);
        $this->assertEquals($this->item->id, $wonItem->item->id);
    }

    public function test_won_item_belongs_to_winner(): void
    {
        $wonItem = WonItem::factory()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
        ]);

        $this->assertInstanceOf(User::class, $wonItem->winner);
        $this->assertEquals($this->participant->id, $wonItem->winner->id);
    }

    public function test_pending_won_item_can_be_created(): void
    {
        $wonItem = WonItem::factory()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
        ]);

        $this->assertEquals('pending', $wonItem->payment_status);
    }

    public function test_paid_won_item_can_be_created(): void
    {
        $wonItem = WonItem::factory()->paid()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
        ]);

        $this->assertEquals('paid', $wonItem->payment_status);
        $this->assertNotNull($wonItem->paid_at);
    }

    public function test_confirmed_won_item_can_be_created(): void
    {
        $wonItem = WonItem::factory()->confirmed()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
        ]);

        $this->assertEquals('confirmed', $wonItem->payment_status);
        $this->assertNotNull($wonItem->payment_confirmed_at);
        $this->assertEquals('preparing', $wonItem->delivery_status);
    }

    public function test_shipped_won_item_can_be_created(): void
    {
        $wonItem = WonItem::factory()->shipped()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
        ]);

        $this->assertEquals('shipped', $wonItem->delivery_status);
        $this->assertNotNull($wonItem->tracking_number);
        $this->assertNotNull($wonItem->shipped_at);
    }

    public function test_completed_won_item_can_be_created(): void
    {
        $wonItem = WonItem::factory()->completed()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
        ]);

        $this->assertEquals('completed', $wonItem->delivery_status);
        $this->assertNotNull($wonItem->delivered_at);
    }

    public function test_total_amount_is_calculated_correctly(): void
    {
        $winningPrice = 30000;
        $commissionAmount = 1500; // 5%
        $shippingFee = 800;

        $wonItem = WonItem::factory()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
            'winning_price' => $winningPrice,
            'commission_amount' => $commissionAmount,
            'total_amount' => $winningPrice + $commissionAmount + $shippingFee,
        ]);

        $this->assertEquals($winningPrice + $commissionAmount + $shippingFee, $wonItem->total_amount);
    }
}
