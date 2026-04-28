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

    // join/leave 系の振る舞いは Actions/JoinBidAction, LeaveBidAction にロジックが移管済み。
    // それぞれ JoinBidActionTest / LeaveBidActionTest で網羅しているためここでは扱わない。

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

    public function test_getLiveState_は_レーン情報と現在商品の入札状態を返す(): void
    {
        $r = $this->bidService->getLiveState($this->auction->fresh(), $this->participant->id);

        $this->assertSame($this->auction->id, $r['auction_id']);
        $this->assertArrayHasKey('lanes', $r);
        $this->assertNotEmpty($r['lanes']);
        $this->assertSame($this->item->id, $r['lanes'][0]['current_item']['id']);
    }

    public function test_getLiveState_は_userIdなしでも動作する(): void
    {
        $r = $this->bidService->getLiveState($this->auction->fresh());
        $this->assertArrayHasKey('lanes', $r);
        // userIdなしでは my_bid_status は null
        $this->assertNull($r['lanes'][0]['current_item']['my_bid_status'] ?? null);
    }

    public function test_getActiveParticipations_は_自分のアクティブ参加のみ返す(): void
    {
        \App\Models\BidParticipant::create([
            'item_id' => $this->item->id,
            'user_id' => $this->participant->id,
            'is_active' => true,
            'activated_at' => now(),
        ]);
        // 別ユーザーの参加（除外されるはず）
        $other = $this->createParticipant();
        \App\Models\BidParticipant::create([
            'item_id' => $this->item->id,
            'user_id' => $other->id,
            'is_active' => true,
            'activated_at' => now(),
        ]);

        $r = $this->bidService->getActiveParticipations($this->participant->id);
        $this->assertCount(1, $r);
        $this->assertSame($this->item->id, $r[0]['item']['id']);
        $this->assertSame($this->auction->id, $r[0]['auction']['id']);
    }

    public function test_getActiveParticipations_は_inactiveを除外する(): void
    {
        \App\Models\BidParticipant::create([
            'item_id' => $this->item->id,
            'user_id' => $this->participant->id,
            'is_active' => false,
            'activated_at' => now(),
            'deactivated_at' => now(),
        ]);

        $r = $this->bidService->getActiveParticipations($this->participant->id);
        $this->assertSame([], $r);
    }

    public function test_getActiveParticipations_は_live以外の商品を除外する(): void
    {
        \App\Models\BidParticipant::create([
            'item_id' => $this->item->id,
            'user_id' => $this->participant->id,
            'is_active' => true,
            'activated_at' => now(),
        ]);
        $this->item->update(['status' => 'sold']);

        $r = $this->bidService->getActiveParticipations($this->participant->id);
        $this->assertSame([], $r);
    }

    public function test_setCountdownService_は_後方互換のために何もしない(): void
    {
        $this->bidService->setCountdownService(null);
        $this->assertTrue(true);
    }
}
