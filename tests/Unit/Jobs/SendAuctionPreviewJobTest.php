<?php

namespace Tests\Unit\Jobs;

use App\Jobs\SendAuctionPreviewJob;
use App\Jobs\SendLineNotificationJob;
use App\Mail\AuctionPreviewMail;
use App\Models\Auction;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class SendAuctionPreviewJobTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Mail::fake();
        Bus::fake();
    }

    public function test_handle_returns_early_when_no_auction_tomorrow(): void
    {
        $this->createParticipant();
        // 翌日のスケジュール済オークションが存在しない
        Auction::factory()->scheduled()->create([
            'event_date' => now()->addWeek()->toDateString(),
            'created_by' => $this->createAdmin()->id,
        ]);

        (new SendAuctionPreviewJob())->handle();

        Mail::assertNothingQueued();
        Bus::assertNotDispatched(SendLineNotificationJob::class);
    }

    public function test_handle_queues_mail_and_dispatches_line_job_for_tomorrow_auction(): void
    {
        $admin = $this->createAdmin();
        $participant = $this->createParticipant();
        $participant->update([
            'is_active' => true,
            'notification_settings' => ['email_auction_start' => true],
        ]);
        $seller = $this->createSeller();
        $seller->update([
            'is_active' => true,
            'notification_settings' => ['email_auction_start' => true],
        ]);

        Auction::factory()->scheduled()->create([
            'event_date' => now()->addDay()->toDateString(),
            'created_by' => $admin->id,
        ]);

        (new SendAuctionPreviewJob())->handle();

        Mail::assertQueued(AuctionPreviewMail::class, 2); // participant + seller
        Bus::assertDispatched(SendLineNotificationJob::class, 2);
    }

    public function test_handle_skips_email_when_user_disabled_setting(): void
    {
        $admin = $this->createAdmin();
        $participant = $this->createParticipant();
        $participant->update([
            'is_active' => true,
            'notification_settings' => ['email_auction_start' => false],
        ]);

        Auction::factory()->scheduled()->create([
            'event_date' => now()->addDay()->toDateString(),
            'created_by' => $admin->id,
        ]);

        (new SendAuctionPreviewJob())->handle();

        Mail::assertNotQueued(AuctionPreviewMail::class);
        // メール無効でも LINE 通知ジョブはディスパッチされる
        Bus::assertDispatched(SendLineNotificationJob::class);
    }

    public function test_handle_skips_inactive_users(): void
    {
        $admin = $this->createAdmin();
        $participant = $this->createParticipant();
        $participant->update([
            'is_active' => false,
            'notification_settings' => ['email_auction_start' => true],
        ]);

        Auction::factory()->scheduled()->create([
            'event_date' => now()->addDay()->toDateString(),
            'created_by' => $admin->id,
        ]);

        (new SendAuctionPreviewJob())->handle();

        Mail::assertNothingQueued();
        Bus::assertNotDispatched(SendLineNotificationJob::class);
    }

    public function test_handle_filters_test_auction_to_test_users_only(): void
    {
        // テストオークション（auctions.is_test=true）は test mode の状態と独立して
        // is_test=true ユーザーにしか通知が飛ばないこと
        $admin = $this->createAdmin();

        $prodParticipant = $this->createParticipant();
        $prodParticipant->update([
            'is_active' => true,
            'is_test' => false,
            'notification_settings' => ['email_auction_start' => true],
        ]);

        $testParticipant = $this->createParticipant();
        $testParticipant->update([
            'is_active' => true,
            'is_test' => true,
            'notification_settings' => ['email_auction_start' => true],
        ]);

        Auction::factory()->scheduled()->create([
            'event_date' => now()->addDay()->toDateString(),
            'created_by' => $admin->id,
            'is_test' => true,
        ]);

        (new SendAuctionPreviewJob())->handle(app(\App\Services\TestModeService::class));

        // is_test=true 1名分のみ queue されること
        Mail::assertQueued(AuctionPreviewMail::class, 1);
        Mail::assertQueued(AuctionPreviewMail::class, function ($mail) use ($testParticipant) {
            return $mail->hasTo($testParticipant->email);
        });
        // 本番ユーザー宛には届かないこと
        Mail::assertNotQueued(AuctionPreviewMail::class, function ($mail) use ($prodParticipant) {
            return $mail->hasTo($prodParticipant->email);
        });
        // LINE も is_test=true 1名分のみ
        Bus::assertDispatched(SendLineNotificationJob::class, 1);
    }

    public function test_handle_ignores_non_scheduled_auctions(): void
    {
        $admin = $this->createAdmin();
        $this->createParticipant()->update([
            'is_active' => true,
            'notification_settings' => ['email_auction_start' => true],
        ]);

        // live ステータス → 対象外
        Auction::factory()->live()->create([
            'event_date' => now()->addDay()->toDateString(),
            'created_by' => $admin->id,
        ]);

        (new SendAuctionPreviewJob())->handle();

        Mail::assertNothingQueued();
        Bus::assertNotDispatched(SendLineNotificationJob::class);
    }
}
