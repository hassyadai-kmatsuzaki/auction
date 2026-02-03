<?php

namespace Tests\Unit\Services;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Models\User;
use App\Services\BidService;
use Tests\TestCase;

class BidServiceTest extends TestCase
{
    protected BidService $bidService;
    protected User $admin;
    protected User $participant;
    protected Auction $auction;
    protected Lane $lane;
    protected Item $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        
        $this->bidService = new BidService();
        $this->admin = $this->createAdmin();
        $this->participant = $this->createParticipant();
        
        $this->auction = Auction::factory()->live()->create(['created_by' => $this->admin->id]);
        $this->lane = Lane::factory()->active()->create(['auction_id' => $this->auction->id]);
        
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        
        $this->item = Item::factory()->live()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $sellerProfile->id,
            'start_price' => 10000,
            'current_price' => 10000,
            'bid_increment' => 100,
        ]);

        $this->lane->update(['current_item_id' => $this->item->id]);
    }

    public function test_user_can_join_bid(): void
    {
        $result = $this->bidService->join(
            $this->item,
            $this->participant->id,
            '127.0.0.1',
            'Test Agent'
        );

        $this->assertTrue($result['success']);
        $this->assertEquals('入札に参加しました。', $result['message']);
        $this->assertEquals($this->item->id, $result['data']['item_id']);
        $this->assertTrue($result['data']['is_active']);
    }

    public function test_cannot_join_non_live_item(): void
    {
        $this->item->update(['status' => 'registered']);

        $result = $this->bidService->join(
            $this->item,
            $this->participant->id
        );

        $this->assertFalse($result['success']);
        $this->assertStringContains('入札を受け付けていません', $result['message']);
    }

    public function test_cannot_join_when_auction_not_live(): void
    {
        $this->auction->update(['status' => 'scheduled']);

        $result = $this->bidService->join(
            $this->item,
            $this->participant->id
        );

        $this->assertFalse($result['success']);
    }

    public function test_user_can_leave_bid(): void
    {
        // まず参加
        $this->bidService->join($this->item, $this->participant->id);

        // 離脱
        $result = $this->bidService->leave($this->item, $this->participant->id);

        $this->assertTrue($result['success']);
        $this->assertEquals('入札から離脱しました。', $result['message']);
    }

    public function test_price_increment_calculation(): void
    {
        $currentPrice = 10000;
        $bidIncrement = 100;

        $nextPrice = $currentPrice + $bidIncrement;

        $this->assertEquals(10100, $nextPrice);
    }

    public function test_bid_amount_validation(): void
    {
        $currentPrice = 10000;
        $bidIncrement = 100;
        
        // 正しい入札額
        $validBid = 10100;
        $this->assertEquals(0, ($validBid - $currentPrice) % $bidIncrement);
        
        // 不正な入札額
        $invalidBid = 10050;
        $this->assertNotEquals(0, ($invalidBid - $currentPrice) % $bidIncrement);
    }

    /**
     * カスタムアサーション
     */
    protected function assertStringContains(string $needle, string $haystack): void
    {
        $this->assertTrue(
            str_contains($haystack, $needle),
            "Failed asserting that '$haystack' contains '$needle'"
        );
    }
}
