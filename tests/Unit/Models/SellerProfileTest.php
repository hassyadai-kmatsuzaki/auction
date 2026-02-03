<?php

namespace Tests\Unit\Models;

use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use Tests\TestCase;

class SellerProfileTest extends TestCase
{
    protected User $seller;
    protected SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $this->seller->id]);
    }

    public function test_seller_profile_belongs_to_user(): void
    {
        $this->assertInstanceOf(User::class, $this->sellerProfile->user);
        $this->assertEquals($this->seller->id, $this->sellerProfile->user->id);
    }

    public function test_seller_profile_has_many_items(): void
    {
        $admin = $this->createAdmin();
        $auction = \App\Models\Auction::factory()->scheduled()->create(['created_by' => $admin->id]);

        Item::factory()->count(3)->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $this->assertCount(3, $this->sellerProfile->items);
    }

    public function test_seller_profile_has_seller_code(): void
    {
        $this->assertNotEmpty($this->sellerProfile->seller_code);
    }

    public function test_seller_profile_has_seller_name(): void
    {
        $this->assertNotEmpty($this->sellerProfile->seller_name);
    }

    public function test_seller_profile_has_bank_info(): void
    {
        // 既存プロフィールを更新
        $this->sellerProfile->update([
            'bank_name' => 'テスト銀行',
            'bank_branch' => 'テスト支店',
            'account_type' => 'checking',
            'account_number' => '1234567',
            'account_holder' => 'テスト太郎',
        ]);

        $this->sellerProfile->refresh();

        $this->assertEquals('テスト銀行', $this->sellerProfile->bank_name);
        $this->assertEquals('テスト支店', $this->sellerProfile->bank_branch);
        $this->assertEquals('checking', $this->sellerProfile->account_type);
    }

    public function test_seller_profile_notification_settings_cast(): void
    {
        $this->sellerProfile->update([
            'notification_settings' => [
                'email_item_sold' => true,
                'email_payment_received' => false,
            ],
        ]);

        $this->sellerProfile->refresh();

        $this->assertIsArray($this->sellerProfile->notification_settings);
        $this->assertTrue($this->sellerProfile->notification_settings['email_item_sold']);
        $this->assertFalse($this->sellerProfile->notification_settings['email_payment_received']);
    }

    public function test_seller_profile_factory_creates_valid_profile(): void
    {
        $profile = SellerProfile::factory()->create();

        $this->assertNotNull($profile->id);
        $this->assertNotNull($profile->user_id);
        $this->assertNotNull($profile->seller_code);
        $this->assertNotNull($profile->seller_name);
    }
}
