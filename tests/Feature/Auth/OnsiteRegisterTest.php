<?php

namespace Tests\Feature\Auth;

use App\Mail\WonItemNotificationMail;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * 当日会員登録（2026-09-20 第9回向け）。
 *
 * 会場で名前・電話番号・パスワードだけを入力し、承認なし・年会費なしで即入札できる会員を作る。
 * 通知はメールも LINE も飛ばさない。
 */
class OnsiteRegisterTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->setOnsite(enabled: true, code: '');
    }

    private function setOnsite(bool $enabled, string $code): void
    {
        SystemSetting::updateOrCreate(
            ['setting_key' => 'onsite_registration_enabled'],
            ['setting_value' => $enabled ? '1' : '0', 'value_type' => 'boolean', 'category' => 'live_operation', 'display_name' => 'x']
        );
        SystemSetting::updateOrCreate(
            ['setting_key' => 'onsite_registration_code'],
            ['setting_value' => $code, 'value_type' => 'string', 'category' => 'live_operation', 'display_name' => 'x']
        );
        SystemSetting::clearCache();
    }

    private function register(array $overrides = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/auth/onsite-register', array_merge([
            'name'     => '会場 太郎',
            'phone'    => '090-1234-5678',
            'password' => 'password123',
        ], $overrides));
    }

    public function test_plan_and_settings_are_seeded_by_migration(): void
    {
        $plan = Plan::where('code', 'onsite_free')->first();
        $this->assertNotNull($plan);
        $this->assertSame(0, (int) $plan->amount);
        $this->assertTrue($plan->isOneShot());
        $this->assertTrue((bool) $plan->allows_bid);
        $this->assertFalse((bool) $plan->allows_sell);
        $this->assertFalse((bool) $plan->is_active, '加入モーダルに並ばないよう is_active=false');
    }

    public function test_registers_approved_member_with_active_free_subscription_and_token(): void
    {
        $res = $this->register();

        $res->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.is_onsite', true)
            ->assertJsonStructure(['data' => ['token']]);

        $user = User::where('is_onsite', true)->first();
        $this->assertNotNull($user);
        $this->assertSame('approved', $user->status);
        $this->assertTrue($user->is_active);
        $this->assertSame('09012345678', $user->phone, '電話番号は数字のみに正規化される');
        $this->assertSame('onsite+09012345678@onsite.invalid', $user->email);
        $this->assertTrue($user->hasRole('participant'));
        $this->assertFalse($user->notification_settings['email_won_item']);

        $sub = Subscription::where('user_id', $user->id)->with('plan')->first();
        $this->assertNotNull($sub);
        $this->assertTrue($sub->isActive());
        $this->assertSame('onsite_free', $sub->plan->code);
        $this->assertTrue($sub->current_period_end->isAfter(now()->addDays(29)));
    }

    public function test_onsite_member_passes_bid_subscription_gate(): void
    {
        $token = $this->register()->json('data.token');

        // check.subscription:bid 配下。402/403 でなければゲートは通っている（商品が無いので 4xx/5xx は別理由）
        $res = $this->withToken($token)->postJson('/api/participant/bids', ['item_id' => 999999]);
        $this->assertNotContains($res->status(), [401, 402, 403], 'サブスクゲートで弾かれてはいけない');
    }

    public function test_rejected_when_disabled(): void
    {
        $this->setOnsite(enabled: false, code: '');

        $this->register()->assertStatus(403)->assertJsonPath('code', 'ONSITE_REGISTRATION_DISABLED');
        $this->assertSame(0, User::where('is_onsite', true)->count());
    }

    public function test_requires_matching_code_when_configured(): void
    {
        $this->setOnsite(enabled: true, code: 'medaka');

        $this->register(['code' => 'wrong'])->assertStatus(403)->assertJsonPath('code', 'ONSITE_CODE_MISMATCH');
        $this->register()->assertStatus(403);
        $this->register(['code' => 'medaka'])->assertStatus(201);
    }

    public function test_validation(): void
    {
        $this->register(['phone' => '123'])->assertStatus(422)->assertJsonValidationErrors(['phone']);
        $this->register(['password' => 'short'])->assertStatus(422)->assertJsonValidationErrors(['password']);
        $this->register(['name' => ''])->assertStatus(422)->assertJsonValidationErrors(['name']);
    }

    public function test_duplicate_phone_among_onsite_members_is_rejected(): void
    {
        $this->register()->assertStatus(201);
        $this->register(['phone' => '０９０１２３４５６７８'])->assertStatus(422);
        $this->assertSame(1, User::where('is_onsite', true)->count());
    }

    public function test_existing_regular_member_phone_does_not_block_onsite_registration(): void
    {
        User::factory()->create(['phone' => '09012345678', 'status' => 'approved']);

        $this->register()->assertStatus(201);
        $this->assertSame(1, User::where('is_onsite', true)->count());
    }

    public function test_onsite_member_logs_in_with_phone_and_regular_member_still_uses_email(): void
    {
        $this->register()->assertStatus(201);
        $regular = User::factory()->create([
            'phone'     => '09012345678',
            'password'  => bcrypt('regular-pass'),
            'status'    => 'approved',
            'is_active' => true,
        ]);

        // 登録直後はトークンが生きているので、別端末ログインは多重ログイン確認（409）を経て force で通る
        $this->postJson('/api/auth/login', ['login' => '090-1234-5678', 'password' => 'password123'])
            ->assertStatus(409);

        // 電話番号（ハイフン付き）+ パスワードで当日会員がログインできる
        $this->postJson('/api/auth/login', ['login' => '090-1234-5678', 'password' => 'password123', 'force_logout_others' => true])
            ->assertOk()
            ->assertJsonPath('data.user.is_onsite', true);

        // 同じ電話番号の正会員は電話番号ログインの対象外（正会員のパスワードでは入れない）
        $this->postJson('/api/auth/login', ['login' => '09012345678', 'password' => 'regular-pass'])
            ->assertStatus(401);

        // 正会員はメールアドレスで従来どおり
        $this->postJson('/api/auth/login', ['email' => $regular->email, 'password' => 'regular-pass'])
            ->assertOk()
            ->assertJsonPath('data.user.is_onsite', false);
    }

    public function test_mail_to_onsite_member_is_cancelled_by_listener(): void
    {
        $this->register()->assertStatus(201);
        $user = User::where('is_onsite', true)->first();

        // Mail::fake() だと MessageSending が発火しないので array トランスポートで実送信経路を通す
        config(['mail.default' => 'array']);
        Mail::to($user->email)->send(new \App\Mail\OtherDeviceLoggedInMail(
            user: $user, loginIp: '127.0.0.1', loginUserAgent: 'test', loginAt: now()->toDateTimeString(),
        ));

        $sent = app('mailer')->getSymfonyTransport()->messages();
        $this->assertCount(0, $sent, '当日会員宛のメールはリスナーで取り消される');
    }

    public function test_mail_to_regular_member_is_still_sent(): void
    {
        $regular = User::factory()->create(['status' => 'approved']);

        config(['mail.default' => 'array']);
        Mail::to($regular->email)->send(new \App\Mail\OtherDeviceLoggedInMail(
            user: $regular, loginIp: '127.0.0.1', loginUserAgent: 'test', loginAt: now()->toDateTimeString(),
        ));

        $sent = app('mailer')->getSymfonyTransport()->messages();
        $this->assertCount(1, $sent);
    }

    public function test_admin_can_set_password_for_onsite_member_only(): void
    {
        $admin = $this->createAdmin();
        $this->register()->assertStatus(201);
        $onsite = User::where('is_onsite', true)->first();
        $regular = $this->createParticipant();
        $this->assertSame(1, $onsite->tokens()->count());

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/users/{$onsite->id}/set-password", ['password' => 'newpass123'])
            ->assertOk();

        // 旧トークンは全削除され、新パスワードで（トークンが無いので 409 にならず）ログインできる
        $this->assertSame(0, $onsite->tokens()->count());
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('newpass123', $onsite->fresh()->password));

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/users/{$regular->id}/set-password", ['password' => 'newpass123'])
            ->assertStatus(422);
    }

    public function test_onsite_member_can_link_line_but_receives_no_line_notification(): void
    {
        config(['services.line.login_redirect_uri' => 'https://example.com/callback']);
        $token = $this->register()->json('data.token');
        $user = User::where('is_onsite', true)->first();

        // 連携の入口は通る
        $this->withToken($token)->getJson('/api/line/settings/redirect')->assertOk();

        // 連携済みの状態を作っても LINE Push は呼ばれない
        \App\Models\LineAccount::create([
            'user_id'      => $user->id,
            'line_user_id' => 'U' . str_repeat('a', 32),
            'display_name' => 'onsite',
            'is_active'    => true,
            'linked_at'    => now(),
        ]);
        \Illuminate\Support\Facades\Http::fake();

        $sent = app(\App\Services\LineService::class)->notify($user->id, 'invoice_ready', '🧾 請求書が発行されました');

        $this->assertFalse($sent);
        \Illuminate\Support\Facades\Http::assertNothingSent();
        $this->assertSame(0, \App\Models\LineNotificationLog::where('user_id', $user->id)->count());
    }

    public function test_onsite_member_cannot_change_phone_from_profile(): void
    {
        $token = $this->register()->json('data.token');

        $this->withToken($token)->putJson('/api/participant/settings/profile', [
            'name'  => '会場 次郎',
            'phone' => '080-0000-0000',
        ])->assertOk();

        $user = User::where('is_onsite', true)->first();
        $this->assertSame('会場 次郎', $user->name);
        $this->assertSame('09012345678', $user->phone, '電話番号はログインIDなので本人からは変更不可');
    }

    public function test_admin_user_list_can_filter_onsite_members(): void
    {
        $admin = $this->createAdmin();
        $this->register()->assertStatus(201);
        $this->createParticipant();

        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/users?onsite=1&per_page=all')->assertOk();
        $rows = collect($res->json('data.data'));
        $this->assertTrue($rows->every(fn ($u) => ($u['is_onsite'] ?? false) === true));
        $this->assertGreaterThanOrEqual(1, $rows->count());
    }
}
