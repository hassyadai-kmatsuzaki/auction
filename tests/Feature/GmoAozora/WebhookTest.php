<?php

namespace Tests\Feature\GmoAozora;

use App\Jobs\ProcessGmoDepositNotificationJob;
use App\Models\GmoAozoraToken;
use App\Models\GmoDepositNotification;
use App\Models\SystemSetting;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * GMOあおぞら 入金明細通知 Webhook の受信（Basic + アクセストークン + 任意の署名 + 冪等 + トグル）。
 */
class WebhookTest extends TestCase
{
    private const SECRET = 'client-secret-xyz';
    private const BASIC_USER = 'gmo-wh-dev-02a94253';
    private const BASIC_PASS = 'qG6/dCKSaeRmIBOxbQhdIUMyMK0nZQkW';
    private const ACCESS_TOKEN = 'ACCESS-CURRENT';

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.gmo_aozora.environment'             => 'development',
            'services.gmo_aozora.client_secret'           => self::SECRET,
            'services.gmo_aozora.webhook_basic_user'      => self::BASIC_USER,
            'services.gmo_aozora.webhook_basic_pass'      => self::BASIC_PASS,
            'services.gmo_aozora.webhook_verify_access_token' => true,
            'services.gmo_aozora.min_interval_ms'         => 0,
        ]);
        // マイグレーションで投入済みのキーを ON にする
        SystemSetting::set('gmo_aozora_webhook_enabled', '1');

        GmoAozoraToken::create([
            'environment'   => 'development',
            'access_token'  => self::ACCESS_TOKEN,
            'refresh_token' => 'R',
            'expires_at'    => now()->addDays(30),
        ]);
    }

    private function body(string $messageId = '0000000000123456789', string $amount = '10000'): string
    {
        return json_encode([
            'messageId' => $messageId,
            'timestamp' => '2026-09-24T17:59:59+09:00',
            'account'   => ['raId' => '101011234567', 'raBranchCode' => '101', 'raAccountNumber' => '1234567', 'raHolderName' => 'テスト', 'baseDate' => '2026-09-24', 'baseTime' => '17:59:59+09:00'],
            'vaTransaction' => [
                'vaId' => '5021099622', 'transactionDate' => '2026-09-24', 'valueDate' => '2026-09-24',
                'vaBranchCode' => '502', 'vaBranchNameKana' => 'ｱｼﾞｻｲ', 'vaAccountNumber' => '1099622',
                'vaAccountNameKana' => 'ﾃｽﾄ', 'depositAmount' => $amount, 'remitterNameKana' => 'ﾃｽﾄ ﾀﾛｳ',
                'paymentBankName' => 'ｱｵｿﾞﾗ', 'paymentBranchName' => 'ﾎﾝﾃﾝ', 'partnerName' => 'GMO', 'itemKey' => '20260924175959112541',
            ],
        ], JSON_UNESCAPED_UNICODE);
    }

    private function sign(string $body): string
    {
        return base64_encode(hash_hmac('sha256', $body, self::SECRET, true));
    }

    /**
     * GMO の実際の送り方（Basic + x-access-token、署名なし）を既定にする。
     */
    private function sendWebhook(string $body, array $overrides = [])
    {
        $server = array_merge([
            'PHP_AUTH_USER'       => self::BASIC_USER,
            'PHP_AUTH_PW'         => self::BASIC_PASS,
            'HTTP_X_ACCESS_TOKEN' => self::ACCESS_TOKEN,
            'HTTP_X_EVENTTYPE'    => 'va-deposit-transaction',
            'HTTP_USER_AGENT'     => 'GMO Aozora Net Bank Notification Service Agent',
            'CONTENT_TYPE'        => 'application/json;charset=UTF-8',
        ], $overrides);
        return $this->call('POST', '/api/gmo-aozora/webhook', [], [], [], $server, $body);
    }

    public function test_signature_is_not_required_by_default(): void
    {
        // .env に何も書かなければ署名検証は OFF（Basic 認証のみで申請済みのため）
        $services = require base_path('config/services.php');
        $this->assertFalse((bool) $services['gmo_aozora']['webhook_verify_signature']);
        $this->assertTrue((bool) $services['gmo_aozora']['webhook_verify_access_token']);
        $this->assertSame(1000, $services['gmo_aozora']['min_interval_ms']);
    }

    public function test_rejects_wrong_basic_auth(): void
    {
        Queue::fake();
        $this->sendWebhook($this->body(), ['PHP_AUTH_PW' => 'wrong'])->assertStatus(401);
        $this->assertDatabaseCount('gmo_deposit_notifications', 0);
        Queue::assertNothingPushed();
    }

    public function test_rejects_missing_or_wrong_access_token(): void
    {
        Queue::fake();
        $this->sendWebhook($this->body(), ['HTTP_X_ACCESS_TOKEN' => ''])->assertStatus(401);
        $this->sendWebhook($this->body(), ['HTTP_X_ACCESS_TOKEN' => 'forged'])->assertStatus(401);
        $this->assertDatabaseCount('gmo_deposit_notifications', 0);
        Queue::assertNothingPushed();
    }

    public function test_rejects_when_not_yet_authorized(): void
    {
        Queue::fake();
        GmoAozoraToken::query()->delete();
        $this->sendWebhook($this->body())->assertStatus(401);
        $this->assertDatabaseCount('gmo_deposit_notifications', 0);
    }

    public function test_accepts_previous_token_within_grace_only(): void
    {
        Queue::fake();
        $t = GmoAozoraToken::first();
        $t->forceFill([
            'access_token' => 'ACCESS-NEW',
            'previous_access_token' => self::ACCESS_TOKEN,
            'previous_token_valid_until' => now()->addMinutes(30),
        ])->save();
        $this->sendWebhook($this->body('0000000000000000001'))->assertStatus(200);

        $t->forceFill(['previous_token_valid_until' => now()->subMinute()])->save();
        $this->sendWebhook($this->body('0000000000000000002'))->assertStatus(401);

        $this->sendWebhook($this->body('0000000000000000003'), ['HTTP_X_ACCESS_TOKEN' => 'ACCESS-NEW'])->assertStatus(200);
        $this->assertDatabaseCount('gmo_deposit_notifications', 2);
    }

    public function test_access_token_check_can_be_disabled(): void
    {
        Queue::fake();
        config(['services.gmo_aozora.webhook_verify_access_token' => false]);
        $this->sendWebhook($this->body(), ['HTTP_X_ACCESS_TOKEN' => 'anything'])->assertStatus(200);
    }

    public function test_signature_enforced_only_when_enabled(): void
    {
        Queue::fake();
        config(['services.gmo_aozora.webhook_verify_signature' => true]);
        $this->sendWebhook($this->body(), ['HTTP_X_WEBHOOK_SIGNATURE' => 'bad'])->assertStatus(401);
        $this->sendWebhook($this->body())->assertStatus(401); // 署名なし
        $this->sendWebhook($this->body(), ['HTTP_X_WEBHOOK_SIGNATURE' => $this->sign($this->body())])->assertStatus(200);
    }

    public function test_returns_500_when_not_configured(): void
    {
        config(['services.gmo_aozora.webhook_basic_user' => '']);
        $this->sendWebhook($this->body())->assertStatus(500);
    }

    public function test_accepts_and_dispatches_job_with_200(): void
    {
        Queue::fake();
        $res = $this->sendWebhook($this->body());
        $res->assertStatus(200);

        $this->assertDatabaseHas('gmo_deposit_notifications', [
            'message_id'     => '0000000000123456789',
            'va_id'          => '5021099622',
            'item_key'       => '20260924175959112541',
            'deposit_amount' => 10000,
            'status'         => 'received',
            'source'         => 'webhook',
        ]);
        Queue::assertPushed(ProcessGmoDepositNotificationJob::class, fn ($job) => $job->queue === 'notify');
    }

    public function test_is_idempotent_on_message_id(): void
    {
        Queue::fake();
        $this->sendWebhook($this->body())->assertStatus(200);
        $this->sendWebhook($this->body())->assertStatus(200)->assertJson(['message' => 'already processed']);
        $this->assertEquals(1, GmoDepositNotification::where('message_id', '0000000000123456789')->count());
        Queue::assertPushed(ProcessGmoDepositNotificationJob::class, 1);
    }

    public function test_disabled_toggle_accepts_without_recording(): void
    {
        Queue::fake();
        SystemSetting::set('gmo_aozora_webhook_enabled', '0');
        $this->sendWebhook($this->body())->assertStatus(200)->assertJson(['message' => 'integration disabled']);
        $this->assertDatabaseCount('gmo_deposit_notifications', 0);
        Queue::assertNothingPushed();
    }

    public function test_ignores_other_event_types(): void
    {
        Queue::fake();
        $this->sendWebhook($this->body(), ['HTTP_X_EVENTTYPE' => 'something-else'])->assertStatus(200)->assertJson(['message' => 'ignored']);
        $this->assertDatabaseCount('gmo_deposit_notifications', 0);
    }

    public function test_inbound_requests_are_written_to_api_log(): void
    {
        Queue::fake();
        $log = sys_get_temp_dir() . '/gmo-api-inbound-' . uniqid() . '.log';
        config(['logging.channels.gmo_aozora_api' => [
            'driver' => 'single', 'path' => $log, 'level' => 'info',
            'tap' => [\App\Logging\PlainJsonFormatter::class],
        ]]);

        $this->sendWebhook($this->body())->assertStatus(200);
        $this->sendWebhook($this->body('0000000000000000009'), ['PHP_AUTH_PW' => 'wrong'])->assertStatus(401);

        $lines = array_map(fn ($l) => json_decode($l, true), file($log, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES));
        $this->assertCount(2, $lines);
        $this->assertSame('inbound', $lines[0]['direction']);
        $this->assertSame('virtual-account', $lines[0]['scope']);
        $this->assertSame(200, $lines[0]['status']);
        $this->assertSame('accepted', $lines[0]['result']);
        $this->assertSame('0000000000123456789', $lines[0]['message_id']);
        $this->assertSame(401, $lines[1]['status']);
        $this->assertSame('basic_auth', $lines[1]['reason']);
        $this->assertStringNotContainsString(self::ACCESS_TOKEN, file_get_contents($log));
        $this->assertStringNotContainsString(self::BASIC_PASS, file_get_contents($log));
        @unlink($log);
    }
}
