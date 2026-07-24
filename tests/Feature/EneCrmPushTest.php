<?php

namespace Tests\Feature;

use App\Jobs\SendEneCrmUpdateJob;
use App\Models\EmailVerificationToken;
use App\Models\EneCrmRequest;
use App\Models\LineAccount;
use App\Models\SystemSetting;
use App\Models\User;
use App\Services\Ene\EneCrmPushService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * auction → E-NE（Cal-Connect）CRM 更新の送信テスト。
 *
 * 実HTTPは Http::fake で止め、「いつ送るか / 何を送るか / 送らない条件」を固定する。
 */
class EneCrmPushTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->seedCrmSettings();
    }

    /**
     * 送信設定を DB に作る（system_settings は行が無いと set() が無視されるため）。
     *
     * @param array<string, mixed> $overrides
     */
    private function seedCrmSettings(array $overrides = []): void
    {
        $defaults = [
            'ene_crm_push_enabled' => ['1', 'boolean'],
            'ene_crm_base_url'     => ['https://ene.test', 'string'],
            'ene_crm_tenant_id'    => ['5', 'string'],
            'ene_crm_api_key'      => ['cc_live_testkey', 'string'],
            'ene_crm_event_map'    => [json_encode([
                'password_set' => [
                    'enabled'            => true,
                    'trigger_automation' => false,
                    'fields'             => [
                        ['name' => 'auction_status', 'value' => 'password_set'],
                        ['name' => 'auction_pw_at',  'value' => '{{date}}'],
                    ],
                ],
                'subscription_paid' => [
                    'enabled'            => true,
                    'trigger_automation' => true,
                    'fields'             => [
                        ['name' => 'auction_plan', 'value' => '{{plan_name}}'],
                        ['name' => 'member_rank',  'value' => '["gold"]'],
                    ],
                ],
                'bank_transfer_requested' => [
                    'enabled'            => false,
                    'trigger_automation' => false,
                    'fields'             => [['name' => 'auction_status', 'value' => 'bank_pending']],
                ],
            ]), 'json'],
        ];

        foreach (array_merge($defaults, $overrides) as $key => [$value, $type]) {
            SystemSetting::updateOrCreate(
                ['setting_key' => $key],
                [
                    'setting_value' => $value,
                    'value_type'    => $type,
                    'category'      => 'external_integration',
                    'display_name'  => $key,
                    'is_public'     => false,
                ],
            );
        }

        SystemSetting::clearCache();
    }

    private function eneMember(array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'status'           => 'approved',
            'approved_at'      => now(),
            'ene_line_user_id' => 'U1a2b3c4d5e6f',
            'ene_customer_id'  => 1000042,
        ], $overrides));
    }

    public function test_パスワード設定でCRM更新ジョブが積まれる(): void
    {
        Queue::fake();

        $user  = $this->eneMember();
        $token = Str::random(64);
        EmailVerificationToken::create([
            'user_id'    => $user->id,
            'token'      => $token,
            'expires_at' => now()->addDays(7),
        ]);

        $response = $this->postJson('/api/auth/set-password', [
            'token'                 => $token,
            'password'              => 'password1234',
            'password_confirmation' => 'password1234',
        ]);

        $response->assertOk();

        $request = EneCrmRequest::where('user_id', $user->id)->firstOrFail();
        $this->assertSame(EneCrmRequest::EVENT_PASSWORD_SET, $request->event);
        $this->assertSame(EneCrmRequest::STATUS_PENDING, $request->status);
        $this->assertSame('password_set', $request->fields['auction_status']);
        $this->assertSame(now()->format('Y-m-d'), $request->fields['auction_pw_at']);
        $this->assertFalse($request->trigger_automation);

        Queue::assertPushed(SendEneCrmUpdateJob::class);
    }

    public function test_連携が無効なら送信しない(): void
    {
        Queue::fake();
        $this->seedCrmSettings(['ene_crm_push_enabled' => ['0', 'boolean']]);

        $user = $this->eneMember();
        app(EneCrmPushService::class)->push($user, EneCrmRequest::EVENT_PASSWORD_SET);

        $this->assertSame(0, EneCrmRequest::count());
        Queue::assertNothingPushed();
    }

    public function test_イベントがOFFなら送信しない(): void
    {
        Queue::fake();

        $user = $this->eneMember();
        app(EneCrmPushService::class)->push($user, EneCrmRequest::EVENT_BANK_TRANSFER_REQUESTED);

        $this->assertSame(0, EneCrmRequest::count());
        Queue::assertNothingPushed();
    }

    public function test_接続情報が未設定なら送信しない(): void
    {
        Queue::fake();
        $this->seedCrmSettings(['ene_crm_api_key' => ['', 'string']]);
        config(['services.ene.crm.api_key' => '']);

        $user = $this->eneMember();
        app(EneCrmPushService::class)->push($user, EneCrmRequest::EVENT_PASSWORD_SET);

        $this->assertSame(0, EneCrmRequest::count());
        Queue::assertNothingPushed();
    }

    public function test_line_user_idが解決できない会員はskippedで記録しジョブは積まない(): void
    {
        Queue::fake();

        $user = $this->eneMember(['ene_line_user_id' => null, 'ene_customer_id' => null]);
        app(EneCrmPushService::class)->push($user, EneCrmRequest::EVENT_PASSWORD_SET);

        $request = EneCrmRequest::where('user_id', $user->id)->firstOrFail();
        $this->assertSame(EneCrmRequest::STATUS_SKIPPED, $request->status);
        Queue::assertNothingPushed();
    }

    public function test_ene由来でなくてもLINE連携済みなら送信先を解決する(): void
    {
        Queue::fake();

        $user = $this->eneMember(['ene_line_user_id' => null]);
        LineAccount::create([
            'user_id'      => $user->id,
            'line_user_id' => 'Ulinked999',
            'display_name' => 'テスト',
            'is_active'    => true,
            'linked_at'    => now(),
        ]);

        app(EneCrmPushService::class)->push($user->fresh(), EneCrmRequest::EVENT_PASSWORD_SET);

        $request = EneCrmRequest::where('user_id', $user->id)->firstOrFail();
        $this->assertSame(EneCrmRequest::STATUS_PENDING, $request->status);
        $this->assertSame('Ulinked999', $request->line_user_id);
    }

    public function test_銀行振込の申請でCRM更新ジョブが積まれる(): void
    {
        Queue::fake();
        $this->seedCrmSettings(['ene_crm_event_map' => [json_encode([
            'bank_transfer_requested' => [
                'enabled'            => true,
                'trigger_automation' => false,
                'fields'             => [
                    ['name' => 'auction_status', 'value' => 'bank_pending'],
                    ['name' => 'auction_amount', 'value' => '{{amount}}'],
                ],
            ],
        ]), 'json']]);

        $user = $this->eneMember();
        $plan = \App\Models\Plan::create([
            'code' => 'both_' . uniqid(), 'name' => '年会費プラン', 'amount' => 11000,
            'allows_bid' => true, 'allows_sell' => true, 'is_active' => true,
        ]);

        app(\App\Services\Payment\SubscriptionService::class)->subscribeWithBankTransfer($user, $plan);

        $request = EneCrmRequest::where('user_id', $user->id)->firstOrFail();
        $this->assertSame(EneCrmRequest::EVENT_BANK_TRANSFER_REQUESTED, $request->event);
        $this->assertSame(EneCrmRequest::STATUS_PENDING, $request->status);
        $this->assertSame('bank_pending', $request->fields['auction_status']);
        // 金額は数値型のまま送る（文字列だと E-NE の number / currency 型で弾かれうる）
        $this->assertSame(11000, $request->fields['auction_amount']);

        Queue::assertPushed(SendEneCrmUpdateJob::class);
    }

    public function test_値は型に合わせて変換される(): void
    {
        Queue::fake();
        $this->seedCrmSettings(['ene_crm_event_map' => [json_encode([
            'password_set' => [
                'enabled'            => true,
                'trigger_automation' => false,
                'fields'             => [
                    ['name' => 'f_select',   'value' => '["gold"]'],
                    ['name' => 'f_checkbox', 'value' => 'true'],
                    ['name' => 'f_number',   'value' => '1000'],
                    ['name' => 'f_text',     'value' => '電話希望'],
                    ['name' => 'f_zero_pad', 'value' => '0012'],   // 会員番号等は文字列のまま
                    ['name' => 'f_date',     'value' => '{{date}}'],
                ],
            ],
        ]), 'json']]);

        $user = $this->eneMember();
        $request = app(EneCrmPushService::class)->push($user, EneCrmRequest::EVENT_PASSWORD_SET);

        $this->assertSame(['gold'], $request->fields['f_select']);
        $this->assertTrue($request->fields['f_checkbox']);
        $this->assertSame(1000, $request->fields['f_number']);
        $this->assertSame('電話希望', $request->fields['f_text']);
        $this->assertSame('0012', $request->fields['f_zero_pad']);
        $this->assertSame(now()->format('Y-m-d'), $request->fields['f_date']);
    }

    public function test_ジョブはPATCHで送りselect値を配列にする(): void
    {
        Queue::fake(); // sync ドライバで push() 内から即実行されるのを防ぎ、Job を明示的に走らせる
        Http::fake(['*' => Http::response(['message' => '更新しました'], 200)]);

        $user = $this->eneMember();
        $request = app(EneCrmPushService::class)->push($user, EneCrmRequest::EVENT_SUBSCRIPTION_PAID, [
            'plan_name' => '年会費プラン',
        ]);

        $this->assertNotNull($request);
        (new SendEneCrmUpdateJob($request->id))->handle(app(\App\Services\Ene\EneCrmClient::class));

        Http::assertSent(function ($sent) {
            return $sent->method() === 'PATCH'
                && $sent->url() === 'https://ene.test/api/external/5/customers/U1a2b3c4d5e6f'
                && $sent->hasHeader('Authorization', 'Bearer cc_live_testkey')
                && $sent['fields']['auction_plan'] === '年会費プラン'
                && $sent['fields']['member_rank'] === ['gold']   // select は配列で送る
                && $sent['trigger_automation'] === true;
        });

        $request->refresh();
        $this->assertSame(EneCrmRequest::STATUS_SUCCESS, $request->status);
        $this->assertSame(200, $request->http_status);
        $this->assertNotNull($request->sent_at);
    }

    public function test_存在しないフィールド名は200でも失敗として記録する(): void
    {
        Queue::fake();
        // E-NE は未知のフィールド名を 200 のまま skipped_fields で黙って捨てる。
        // これを成功にすると「ログは成功なのにE-NE側が変わらない」事故になる。
        Http::fake(['*' => Http::response([
            'message'        => '更新しました',
            'updated_fields' => [],
            'skipped_fields' => [
                ['field' => 'auction_status', 'reason' => 'unknown_field'],
                ['field' => 'auction_pw_at',  'reason' => 'unchanged'],
            ],
        ], 200)]);

        $user = $this->eneMember();
        $request = app(EneCrmPushService::class)->push($user, EneCrmRequest::EVENT_PASSWORD_SET);

        (new SendEneCrmUpdateJob($request->id))->handle(app(\App\Services\Ene\EneCrmClient::class));

        $request->refresh();
        $this->assertSame(EneCrmRequest::STATUS_FAILED, $request->status);
        $this->assertStringContainsString('auction_status', (string) $request->error);
        // reason=unchanged は正常なのでエラー文言に混ぜない
        $this->assertStringNotContainsString('auction_pw_at', (string) $request->error);
    }

    public function test_すべてunchangedなら成功として記録する(): void
    {
        Queue::fake();
        Http::fake(['*' => Http::response([
            'message'        => '更新しました',
            'updated_fields' => [],
            'skipped_fields' => [['field' => 'auction_status', 'reason' => 'unchanged']],
        ], 200)]);

        $user = $this->eneMember();
        $request = app(EneCrmPushService::class)->push($user, EneCrmRequest::EVENT_PASSWORD_SET);

        (new SendEneCrmUpdateJob($request->id))->handle(app(\App\Services\Ene\EneCrmClient::class));

        $request->refresh();
        $this->assertSame(EneCrmRequest::STATUS_SUCCESS, $request->status);
    }

    public function test_404はリトライせずfailedで記録する(): void
    {
        Queue::fake(); // sync ドライバで push() 内から即実行されるのを防ぎ、Job を明示的に走らせる
        Http::fake(['*' => Http::response(['message' => '顧客が見つかりません'], 404)]);

        $user = $this->eneMember();
        $request = app(EneCrmPushService::class)->push($user, EneCrmRequest::EVENT_PASSWORD_SET);

        // 例外を投げない = Job のリトライに乗せない
        (new SendEneCrmUpdateJob($request->id))->handle(app(\App\Services\Ene\EneCrmClient::class));

        $request->refresh();
        $this->assertSame(EneCrmRequest::STATUS_FAILED, $request->status);
        $this->assertSame(404, $request->http_status);
    }

    public function test_500は例外を投げてリトライさせる(): void
    {
        Queue::fake(); // sync ドライバで push() 内から即実行されるのを防ぎ、Job を明示的に走らせる
        Http::fake(['*' => Http::response(['message' => 'error'], 500)]);

        $user = $this->eneMember();
        $request = app(EneCrmPushService::class)->push($user, EneCrmRequest::EVENT_PASSWORD_SET);

        $this->expectException(\RuntimeException::class);
        (new SendEneCrmUpdateJob($request->id))->handle(app(\App\Services\Ene\EneCrmClient::class));
    }

    public function test_APIキーは管理画面へマスクして返し空保存では消えない(): void
    {
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin)->getJson('/api/admin/settings');
        $response->assertOk();
        $masked = $response->json('data.settings.external_integration.ene_crm_api_key.value');
        $this->assertSame('cc_live_test…', $masked);

        // 画面がマスク済みの値をそのまま送り返しても、保存済みキーは壊れない
        $this->actingAs($admin)->putJson('/api/admin/settings', [
            'settings' => ['ene_crm_api_key' => $masked],
        ])->assertOk();

        SystemSetting::clearCache();
        $this->assertSame('cc_live_testkey', SystemSetting::get('ene_crm_api_key'));

        // 新しいキーを入れれば更新される
        $this->actingAs($admin)->putJson('/api/admin/settings', [
            'settings' => ['ene_crm_api_key' => 'cc_live_newkey'],
        ])->assertOk();

        SystemSetting::clearCache();
        $this->assertSame('cc_live_newkey', SystemSetting::get('ene_crm_api_key'));
    }
}
