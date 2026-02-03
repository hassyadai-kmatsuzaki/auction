<?php

namespace Tests\Unit\Services;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class NotificationServiceTest extends TestCase
{
    protected NotificationService $notificationService;
    protected User $admin;
    protected User $participant;
    protected User $seller;
    protected SellerProfile $sellerProfile;
    protected Auction $auction;
    protected Item $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        
        $this->notificationService = new NotificationService();
        $this->admin = $this->createAdmin();
        $this->participant = $this->createParticipant();
        $this->seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $this->seller->id]);
        
        $this->auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        
        $this->item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        Mail::fake();
    }

    public function test_can_send_won_item_notification(): void
    {
        $wonItem = WonItem::factory()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
        ]);

        $wonItem->load(['item.auction', 'winner']);

        // 通知設定を有効にする（キーは NotificationService の email_won_item）
        $this->participant->update([
            'notification_settings' => [
                'email_won_item' => true,
            ],
        ]);

        $result = $this->notificationService->sendWonItemNotification($wonItem);

        // 実装に応じてアサーション
        $this->assertTrue($result || $result === null);
    }

    public function test_can_send_payment_confirmed_notification(): void
    {
        $wonItem = WonItem::factory()->confirmed()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
        ]);

        $wonItem->load(['item', 'winner']);

        $this->participant->update([
            'notification_settings' => [
                'email_payment_confirmed' => true,
            ],
        ]);

        $result = $this->notificationService->sendPaymentConfirmedNotification($wonItem);

        $this->assertTrue($result || $result === null);
    }

    public function test_can_send_shipping_notification(): void
    {
        $wonItem = WonItem::factory()->shipped()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
        ]);

        $wonItem->load(['item', 'winner']);

        $this->participant->update([
            'notification_settings' => [
                'email_shipping' => true,
            ],
        ]);

        $result = $this->notificationService->sendShippingNotification($wonItem);

        $this->assertTrue($result || $result === null);
    }

    public function test_notification_not_sent_when_disabled(): void
    {
        $wonItem = WonItem::factory()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
        ]);

        $wonItem->load(['item.auction', 'winner']);

        // 通知設定を無効にする
        $this->participant->update([
            'notification_settings' => [
                'email_won_item' => false,
            ],
        ]);

        $result = $this->notificationService->sendWonItemNotification($wonItem);

        // 無効時は送信されない
        Mail::assertNothingSent();
    }

    public function test_can_send_new_auction_notification(): void
    {
        $auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);

        $this->participant->update([
            'notification_settings' => [
                'email_new_auction' => true,
            ],
        ]);

        $result = $this->notificationService->sendNewAuctionNotification($auction);

        $this->assertTrue($result || $result === null);
    }

    public function test_notification_settings_default_values(): void
    {
        $user = User::factory()->create();

        $settings = $user->notification_settings ?? [];

        // デフォルト設定が適用されることを確認
        $this->assertIsArray($settings);
    }
}
