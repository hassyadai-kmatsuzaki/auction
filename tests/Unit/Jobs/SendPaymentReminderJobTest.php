<?php

namespace Tests\Unit\Jobs;

use App\Jobs\SendPaymentReminderJob;
use App\Mail\PaymentReminderMail;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\WonItem;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class SendPaymentReminderJobTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Mail::fake();
        Cache::flush();
    }

    private function makeWonItem(\DateTimeInterface $deadline, string $paymentStatus = 'pending'): WonItem
    {
        $admin = $this->createAdmin();
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $auction = Auction::factory()->finished()->create(['created_by' => $admin->id]);
        $item = Item::factory()->sold()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);
        $winner = $this->createParticipant();
        $winner->update(['notification_settings' => ['email_payment_reminder' => true]]);

        return WonItem::factory()->create([
            'item_id' => $item->id,
            'winner_id' => $winner->id,
            'payment_status' => $paymentStatus,
            'payment_deadline' => $deadline,
        ]);
    }

    public function test_dispatches_one_hour_reminder_and_sets_cache_key(): void
    {
        $w = $this->makeWonItem(now()->addMinutes(30));

        app(SendPaymentReminderJob::class)->handle(app(NotificationService::class));

        Mail::assertQueued(PaymentReminderMail::class, function (PaymentReminderMail $m) use ($w) {
            return $m->wonItem->id === $w->id && $m->urgency === '1時間以内';
        });
        $this->assertTrue(Cache::has("payment_reminder:1h:{$w->id}"));
    }

    public function test_dispatches_24_hour_reminder_and_sets_cache_key(): void
    {
        $w = $this->makeWonItem(now()->addHours(20));

        app(SendPaymentReminderJob::class)->handle(app(NotificationService::class));

        Mail::assertQueued(PaymentReminderMail::class, function (PaymentReminderMail $m) use ($w) {
            return $m->wonItem->id === $w->id && $m->urgency === '24時間以内';
        });
        $this->assertTrue(Cache::has("payment_reminder:24h:{$w->id}"));
    }

    public function test_skips_already_notified_won_item_via_cache(): void
    {
        $w = $this->makeWonItem(now()->addMinutes(15));
        Cache::put("payment_reminder:1h:{$w->id}", true, now()->addHour());

        app(SendPaymentReminderJob::class)->handle(app(NotificationService::class));

        Mail::assertNothingQueued();
    }

    public function test_does_not_notify_paid_or_outside_window(): void
    {
        // すでに支払い済 → 対象外
        $this->makeWonItem(now()->addMinutes(30), 'paid');
        // 24h より先 → 対象外
        $this->makeWonItem(now()->addDays(3));
        // 期限切れ → 対象外
        $this->makeWonItem(now()->subHour());

        app(SendPaymentReminderJob::class)->handle(app(NotificationService::class));

        Mail::assertNothingQueued();
    }

    public function test_one_hour_window_excluded_from_24_hour_query(): void
    {
        // 30分後 → 1h バケットにのみ入る
        $w = $this->makeWonItem(now()->addMinutes(30));

        app(SendPaymentReminderJob::class)->handle(app(NotificationService::class));

        $this->assertTrue(Cache::has("payment_reminder:1h:{$w->id}"));
        $this->assertFalse(Cache::has("payment_reminder:24h:{$w->id}"));
    }
}
