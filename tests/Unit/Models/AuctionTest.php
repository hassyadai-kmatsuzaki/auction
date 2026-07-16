<?php

namespace Tests\Unit\Models;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\User;
use Tests\TestCase;

class AuctionTest extends TestCase
{
    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
    }

    public function test_auction_can_be_created(): void
    {
        $auction = Auction::factory()->create(['created_by' => $this->admin->id]);

        $this->assertDatabaseHas('auctions', [
            'id' => $auction->id,
        ]);
    }

    public function test_auction_has_items_relationship(): void
    {
        $auction = Auction::factory()->create(['created_by' => $this->admin->id]);
        
        $this->assertInstanceOf(\Illuminate\Database\Eloquent\Collection::class, $auction->items);
    }

    public function test_auction_has_lanes_relationship(): void
    {
        $auction = Auction::factory()->create(['created_by' => $this->admin->id]);
        
        $this->assertInstanceOf(\Illuminate\Database\Eloquent\Collection::class, $auction->lanes);
    }

    public function test_can_edit_returns_true_for_preparing_status(): void
    {
        $auction = Auction::factory()->preparing()->create(['created_by' => $this->admin->id]);

        $this->assertTrue($auction->canEdit());
    }

    public function test_can_edit_returns_true_for_scheduled_status(): void
    {
        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);

        $this->assertTrue($auction->canEdit());
    }

    public function test_can_edit_returns_false_for_live_status(): void
    {
        $auction = Auction::factory()->live()->create(['created_by' => $this->admin->id]);

        $this->assertFalse($auction->canEdit());
    }

    public function test_can_edit_returns_false_for_finished_status(): void
    {
        $auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);

        $this->assertFalse($auction->canEdit());
    }

    public function test_can_delete_returns_true_for_preparing_without_items(): void
    {
        $auction = Auction::factory()->preparing()->create(['created_by' => $this->admin->id]);

        $this->assertTrue($auction->canDelete());
    }

    public function test_can_delete_returns_false_when_items_exist(): void
    {
        $auction = Auction::factory()->preparing()->create(['created_by' => $this->admin->id]);
        
        $seller = $this->createSeller();
        $sellerProfile = \App\Models\SellerProfile::factory()->create(['user_id' => $seller->id]);
        
        Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);

        $this->assertFalse($auction->canDelete());
    }

    public function test_can_start_returns_true_when_conditions_met(): void
    {
        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
        
        $seller = $this->createSeller();
        $sellerProfile = \App\Models\SellerProfile::factory()->create(['user_id' => $seller->id]);
        
        Item::factory()->registered()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);

        $this->assertTrue($auction->canStart());
    }

    public function test_can_start_returns_false_without_registered_items(): void
    {
        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);

        $this->assertFalse($auction->canStart());
    }

    public function test_can_finish_returns_true_for_live_auction(): void
    {
        $auction = Auction::factory()->live()->create(['created_by' => $this->admin->id]);

        $this->assertTrue($auction->canFinish());
    }

    public function test_can_finish_returns_false_for_non_live_auction(): void
    {
        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);

        $this->assertFalse($auction->canFinish());
    }

    public function test_start_changes_status_to_live(): void
    {
        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
        
        $seller = $this->createSeller();
        $sellerProfile = \App\Models\SellerProfile::factory()->create(['user_id' => $seller->id]);
        
        Item::factory()->registered()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);

        $result = $auction->start();

        $this->assertTrue($result);
        $this->assertEquals('live', $auction->fresh()->status);
    }

    public function test_finish_changes_status_to_finished(): void
    {
        $auction = Auction::factory()->live()->create(['created_by' => $this->admin->id]);

        $result = $auction->finish();

        $this->assertTrue($result);
        $this->assertEquals('finished', $auction->fresh()->status);
    }

    public function test_cancel_changes_status_to_cancelled(): void
    {
        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);

        $result = $auction->cancel();

        $this->assertTrue($result);
        $this->assertEquals('cancelled', $auction->fresh()->status);
    }

    // ─── getStartCountdownSeconds（開始前待機カウントダウン秒数） ───
    // StoreAuctionRequest にバリデーションが無いため、モデル側のクランプが最後の砦。

    public function test_getStartCountdownSeconds_は_設定なしなら10を返す(): void
    {
        $auction = Auction::factory()->create(['created_by' => $this->admin->id]);

        $this->assertSame(10, $auction->getStartCountdownSeconds());
    }

    public function test_getStartCountdownSeconds_は_カスタム設定値を返す(): void
    {
        $auction = Auction::factory()->create([
            'created_by' => $this->admin->id,
            'use_custom_settings' => true,
            'custom_auction_settings' => ['auction_start_countdown_seconds' => 30],
        ]);

        $this->assertSame(30, $auction->getStartCountdownSeconds());
    }

    public function test_getStartCountdownSeconds_は_数値文字列も整数化して返す(): void
    {
        $auction = Auction::factory()->create([
            'created_by' => $this->admin->id,
            'use_custom_settings' => true,
            'custom_auction_settings' => ['auction_start_countdown_seconds' => '60'],
        ]);

        $this->assertSame(60, $auction->getStartCountdownSeconds());
    }

    public function test_getStartCountdownSeconds_は_非数値なら10にフォールバックする(): void
    {
        $auction = Auction::factory()->create([
            'created_by' => $this->admin->id,
            'use_custom_settings' => true,
            'custom_auction_settings' => ['auction_start_countdown_seconds' => 'abc'],
        ]);

        $this->assertSame(10, $auction->getStartCountdownSeconds());
    }

    public function test_getStartCountdownSeconds_は_負値を0にクランプする(): void
    {
        $auction = Auction::factory()->create([
            'created_by' => $this->admin->id,
            'use_custom_settings' => true,
            'custom_auction_settings' => ['auction_start_countdown_seconds' => -5],
        ]);

        $this->assertSame(0, $auction->getStartCountdownSeconds());
    }

    public function test_getStartCountdownSeconds_は_3600超を3600にクランプする(): void
    {
        $auction = Auction::factory()->create([
            'created_by' => $this->admin->id,
            'use_custom_settings' => true,
            'custom_auction_settings' => ['auction_start_countdown_seconds' => 99999],
        ]);

        $this->assertSame(3600, $auction->getStartCountdownSeconds());
    }
}
