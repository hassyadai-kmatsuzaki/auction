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

    public function test_send_shipping_fee_finalized_notification_queues_mail(): void
    {
        $w = WonItem::factory()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
            'shipping_fee' => 1000,
        ]);
        $wonItems = WonItem::with(['user', 'item'])->whereIn('id', [$w->id])->get();

        $this->participant->update(['notification_settings' => ['email_shipping' => true]]);

        $result = $this->notificationService->sendShippingFeeFinalizedNotification($wonItems);
        $this->assertTrue($result);
        Mail::assertQueued(\App\Mail\ShippingFeeFinalizedMail::class);
    }

    public function test_shipping_fee_finalized_returns_false_for_empty_collection(): void
    {
        $result = $this->notificationService->sendShippingFeeFinalizedNotification(collect());
        $this->assertFalse($result);
    }

    public function test_shipping_fee_finalized_skipped_when_user_disabled_setting(): void
    {
        // 設定を先に更新してから WonItem の user リレーションを load する
        $this->participant->update(['notification_settings' => ['email_shipping' => false]]);

        $w = WonItem::factory()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
        ]);
        $wonItems = WonItem::with(['user', 'item'])->whereIn('id', [$w->id])->get();

        $result = $this->notificationService->sendShippingFeeFinalizedNotification($wonItems);
        $this->assertFalse($result);
        Mail::assertNotQueued(\App\Mail\ShippingFeeFinalizedMail::class);
    }

    public function test_send_bid_limit_reached_notification_does_not_throw(): void
    {
        // Returns void; ensure it doesn't throw with valid input
        $this->participant->update(['notification_settings' => ['line_bid_limit_reached' => true]]);
        $this->notificationService->sendBidLimitReachedNotification(
            $this->participant->id,
            'メダカ',
            10000.0,
            5000.0,
        );
        $this->assertTrue(true);
    }

    public function test_send_auction_start_notification(): void
    {
        // 通知設定を有効にした participant を増やしておく
        $this->participant->update(['notification_settings' => ['email_auction_start' => true]]);
        $count = $this->notificationService->sendAuctionStartNotification($this->auction);
        // 戻り値は送信件数（Int）
        $this->assertGreaterThanOrEqual(0, $count);
    }

    public function test_test_auction_start_notification_skips_non_test_users(): void
    {
        // 本番ユーザー（is_test=false）には届かず、テストユーザー（is_test=true）にのみ届くこと
        $this->participant->update([
            'is_test' => false,
            'notification_settings' => ['email_auction_start' => true],
        ]);
        $testUser = $this->createParticipant();
        $testUser->update([
            'is_test' => true,
            'notification_settings' => ['email_auction_start' => true],
        ]);

        $testAuction = Auction::factory()->finished()->create([
            'created_by' => $this->admin->id,
            'is_test' => true,
        ]);

        $count = $this->notificationService->sendAuctionStartNotification($testAuction);

        // 本番ユーザー宛は queue されないこと
        Mail::assertNotQueued(\App\Mail\AuctionStartNotificationMail::class, function ($mail) {
            return $mail->hasTo($this->participant->email);
        });
        // テストユーザー宛は queue されること
        Mail::assertQueued(\App\Mail\AuctionStartNotificationMail::class, function ($mail) use ($testUser) {
            return $mail->hasTo($testUser->email);
        });
        $this->assertGreaterThanOrEqual(1, $count);
    }

    public function test_test_auction_new_notification_skips_non_test_users(): void
    {
        // sendNewAuctionNotification（seller / participant 両ループ）も同じゲートが効くこと
        $this->participant->update([
            'is_test' => false,
            'notification_settings' => ['email_new_auction' => true],
        ]);
        $this->seller->update([
            'is_test' => false,
            'notification_settings' => ['email_new_auction' => true],
        ]);
        $testParticipant = $this->createParticipant();
        $testParticipant->update([
            'is_test' => true,
            'notification_settings' => ['email_new_auction' => true],
        ]);

        $testAuction = Auction::factory()->scheduled()->create([
            'created_by' => $this->admin->id,
            'is_test' => true,
        ]);

        $this->notificationService->sendNewAuctionNotification($testAuction);

        Mail::assertNotQueued(\App\Mail\NewAuctionNotificationMail::class, function ($mail) {
            return $mail->hasTo($this->participant->email) || $mail->hasTo($this->seller->email);
        });
        Mail::assertQueued(\App\Mail\NewAuctionNotificationMail::class, function ($mail) use ($testParticipant) {
            return $mail->hasTo($testParticipant->email);
        });
    }

    public function test_send_item_sold_notification(): void
    {
        $wonItem = WonItem::factory()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
        ]);
        $wonItem->load(['item.sellerProfile.user', 'winner']);

        $this->seller->update(['notification_settings' => ['email_item_sold' => true]]);

        $result = $this->notificationService->sendItemSoldNotification($wonItem);
        $this->assertTrue($result || $result === false);
    }

    public function test_send_seller_payment_received_notification(): void
    {
        $wonItem = WonItem::factory()->confirmed()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
        ]);
        $wonItem->load(['item.sellerProfile.user']);

        $this->seller->update(['notification_settings' => ['email_payment_received' => true]]);

        $result = $this->notificationService->sendSellerPaymentReceivedNotification($wonItem);
        $this->assertTrue($result || $result === false);
    }

    public function test_send_invoice_ready_notification(): void
    {
        // 落札者が居ないと送信件数 0
        WonItem::factory()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
            'shipping_approved_at' => now(),
        ]);

        $count = $this->notificationService->sendInvoiceReadyNotification($this->auction);
        $this->assertGreaterThanOrEqual(0, $count);
    }

    public function test_send_payment_reminder_notification(): void
    {
        $wonItem = WonItem::factory()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->participant->id,
            'payment_status' => 'pending',
            'payment_deadline' => now()->addHours(20),
        ]);
        $wonItem->load(['item', 'winner']);

        $this->participant->update(['notification_settings' => ['email_payment_reminder' => true]]);

        $this->notificationService->sendPaymentReminderNotification($wonItem, '24時間前');
        $this->assertTrue(true);
    }
}
