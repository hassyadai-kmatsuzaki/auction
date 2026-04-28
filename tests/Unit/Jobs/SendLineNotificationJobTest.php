<?php

namespace Tests\Unit\Jobs;

use App\Jobs\SendLineNotificationJob;
use App\Models\LineAccount;
use App\Models\LineNotificationLog;
use App\Models\LineNotificationSetting;
use App\Services\LineService;
use Illuminate\Support\Facades\Http;
use Mockery;
use Tests\TestCase;

class SendLineNotificationJobTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        config(['services.line.messaging_token' => 'test-token']);
    }

    public function test_tries_and_backoff_properties(): void
    {
        $job = new SendLineNotificationJob(1, 'auction_preview', 'hi');
        $this->assertSame(3, $job->tries);
        $this->assertSame(10, $job->backoff);
    }

    public function test_handle_calls_line_service_notify_with_args(): void
    {
        $user = $this->createParticipant();
        $mock = Mockery::mock(LineService::class);
        $mock->shouldReceive('notify')
            ->once()
            ->with($user->id, 'auction_preview', 'hello', null)
            ->andReturn(true);

        (new SendLineNotificationJob($user->id, 'auction_preview', 'hello'))->handle($mock);
        $this->assertTrue(true);
    }

    public function test_handle_skips_when_user_has_no_line_account(): void
    {
        Http::fake();
        $user = $this->createParticipant();
        // LineAccount を作成しない → notify() は false を返して Push API 未呼び出し

        (new SendLineNotificationJob($user->id, 'auction_preview', 'hi'))->handle(app(LineService::class));

        Http::assertNothingSent();
        $this->assertSame(0, LineNotificationLog::count());
    }

    public function test_handle_skips_when_notification_setting_disabled(): void
    {
        Http::fake();
        $user = $this->createParticipant();
        LineAccount::create([
            'user_id' => $user->id,
            'line_user_id' => 'U_TEST_DISABLED',
            'is_active' => true,
            'linked_at' => now(),
        ]);
        LineNotificationSetting::create([
            'user_id' => $user->id,
            'notification_type' => 'auction_preview',
            'is_enabled' => false,
        ]);

        (new SendLineNotificationJob($user->id, 'auction_preview', 'hi'))->handle(app(LineService::class));

        Http::assertNothingSent();
    }

    public function test_handle_pushes_via_line_api_when_linked(): void
    {
        Http::fake([
            'api.line.me/v2/bot/message/push' => Http::response([], 200),
        ]);
        $user = $this->createParticipant();
        LineAccount::create([
            'user_id' => $user->id,
            'line_user_id' => 'U_TEST_OK',
            'is_active' => true,
            'linked_at' => now(),
        ]);

        (new SendLineNotificationJob($user->id, 'auction_preview', '通知本文'))->handle(app(LineService::class));

        Http::assertSent(fn ($req) => str_contains($req->url(), '/v2/bot/message/push'));
        $this->assertSame(1, LineNotificationLog::where('user_id', $user->id)->count());
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
