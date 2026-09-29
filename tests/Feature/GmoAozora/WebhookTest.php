<?php

namespace Tests\Feature\GmoAozora;

use App\Jobs\ProcessGmoDepositNotificationJob;
use App\Models\GmoDepositNotification;
use App\Models\SystemSetting;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * GMOあおぞら 入金明細通知 Webhook の受信（Basic + 署名 + 冪等 + トグル）。
 */
class WebhookTest extends TestCase
{
    private const SECRET = 'client-secret-xyz';
    private const BASIC_USER = 'gmo-wh-dev-02a94253';
    private const BASIC_PASS = 'qG6dCKSaeRmIBOxbQhdIUMyMK0nZQkW';

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.gmo_aozora.client_secret'           => self::SECRET,
            'services.gmo_aozora.webhook_basic_user'      => self::BASIC_USER,
            'services.gmo_aozora.webhook_basic_pass'      => self::BASIC_PASS,
            'services.gmo_aozora.webhook_verify_signature' => true,
        ]);
        // マイグレーションで投入済みのキーを ON にする
        SystemSetting::set('gmo_aozora_webhook_enabled', '1');
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

    private function sendWebhook(string $body, array $overrides = [])
    {
        $server = array_merge([
            'PHP_AUTH_USER'            => self::BASIC_USER,
            'PHP_AUTH_PW'              => self::BASIC_PASS,
            'HTTP_X_WEBHOOK_SIGNATURE' => $this->sign($body),
            'HTTP_X_EVENTTYPE'         => 'va-deposit-transaction',
            'CONTENT_TYPE'             => 'application/json;charset=UTF-8',
        ], $overrides);
        return $this->call('POST', '/api/gmo-aozora/webhook', [], [], [], $server, $body);
    }

    public function test_rejects_wrong_basic_auth(): void
    {
        Queue::fake();
        $this->sendWebhook($this->body(), ['PHP_AUTH_PW' => 'wrong'])->assertStatus(401);
        $this->assertDatabaseCount('gmo_deposit_notifications', 0);
        Queue::assertNothingPushed();
    }

    public function test_rejects_invalid_signature(): void
    {
        Queue::fake();
        $this->sendWebhook($this->body(), ['HTTP_X_WEBHOOK_SIGNATURE' => 'bad'])->assertStatus(401);
        $this->sendWebhook($this->body(), ['HTTP_X_WEBHOOK_SIGNATURE' => ''])->assertStatus(401);
        $this->assertDatabaseCount('gmo_deposit_notifications', 0);
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

    public function test_signature_optional_when_verification_disabled(): void
    {
        Queue::fake();
        config(['services.gmo_aozora.webhook_verify_signature' => false]);
        $this->sendWebhook($this->body('0000000000123456790'), ['HTTP_X_WEBHOOK_SIGNATURE' => ''])->assertStatus(200);
        $this->assertDatabaseCount('gmo_deposit_notifications', 1);
    }
}
