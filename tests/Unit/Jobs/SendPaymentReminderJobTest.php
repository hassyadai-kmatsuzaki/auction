<?php

namespace Tests\Unit\Jobs;

use App\Jobs\SendPaymentReminderJob;
use App\Mail\PaymentReminderMail;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
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

    private function makeWonItem(\DateTimeInterface $deadline, string $paymentStatus = 'pending', ?User $winner = null): WonItem
    {
        $admin = $this->createAdmin();
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $auction = Auction::factory()->finished()->create(['created_by' => $admin->id]);
        $item = Item::factory()->sold()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);
        $winner ??= $this->createParticipant();
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
            return $m->wonItems->count() === 1 && $m->wonItems->first()->id === $w->id && $m->urgency === '1時間以内';
        });
        $this->assertTrue(Cache::has("payment_reminder:1h:{$w->id}"));
    }

    public function test_dispatches_24_hour_reminder_and_sets_cache_key(): void
    {
        $w = $this->makeWonItem(now()->addHours(20));

        app(SendPaymentReminderJob::class)->handle(app(NotificationService::class));

        Mail::assertQueued(PaymentReminderMail::class, function (PaymentReminderMail $m) use ($w) {
            return $m->wonItems->count() === 1 && $m->wonItems->first()->id === $w->id && $m->urgency === '24時間以内';
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

    public function test_same_winner_and_deadline_are_aggregated_into_one_mail(): void
    {
        $winner = $this->createParticipant();
        $deadline = now()->addHours(20);
        $w1 = $this->makeWonItem($deadline, 'pending', $winner);
        $w2 = $this->makeWonItem($deadline, 'pending', $winner);
        $w3 = $this->makeWonItem($deadline, 'pending', $winner);

        app(SendPaymentReminderJob::class)->handle(app(NotificationService::class));

        // 落札者1人 → メール1通（3件分をまとめて）
        Mail::assertQueuedCount(1);
        Mail::assertQueued(PaymentReminderMail::class, function (PaymentReminderMail $m) use ($w1, $w2, $w3) {
            $ids = $m->wonItems->pluck('id')->sort()->values()->all();
            return $ids === collect([$w1->id, $w2->id, $w3->id])->sort()->values()->all()
                && $m->urgency === '24時間以内';
        });

        // 送信済みフラグは WonItem 単位で全件立つ
        foreach ([$w1, $w2, $w3] as $w) {
            $this->assertTrue(Cache::has("payment_reminder:24h:{$w->id}"));
        }
    }

    public function test_different_winners_get_separate_mails(): void
    {
        $deadline = now()->addHours(20);
        $this->makeWonItem($deadline);
        $this->makeWonItem($deadline);

        app(SendPaymentReminderJob::class)->handle(app(NotificationService::class));

        Mail::assertQueuedCount(2);
    }

    public function test_same_winner_with_different_deadlines_are_not_merged(): void
    {
        $winner = $this->createParticipant();
        $this->makeWonItem(now()->addHours(10), 'pending', $winner);
        $this->makeWonItem(now()->addHours(20), 'pending', $winner);

        app(SendPaymentReminderJob::class)->handle(app(NotificationService::class));

        // 期限が違うものを「期限: mm/dd HH:ii」1本の文面にまとめない
        Mail::assertQueuedCount(2);
    }

    public function test_already_notified_item_is_excluded_from_aggregation(): void
    {
        $winner = $this->createParticipant();
        $deadline = now()->addHours(20);
        $sent = $this->makeWonItem($deadline, 'pending', $winner);
        $fresh = $this->makeWonItem($deadline, 'pending', $winner);
        Cache::put("payment_reminder:24h:{$sent->id}", true, $deadline);

        app(SendPaymentReminderJob::class)->handle(app(NotificationService::class));

        // 既送分は再送せず、未送信の1件だけで1通
        Mail::assertQueuedCount(1);
        Mail::assertQueued(PaymentReminderMail::class, function (PaymentReminderMail $m) use ($fresh) {
            return $m->wonItems->count() === 1 && $m->wonItems->first()->id === $fresh->id;
        });
    }
}
