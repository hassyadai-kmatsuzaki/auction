<?php

namespace Tests\Unit\Services;

use App\Models\LineAccount;
use App\Models\LineNotificationSetting;
use App\Models\User;
use App\Services\LineService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * LINE 連携サービスのテスト。
 *
 * - LINE Login の URL 生成 / トークン交換 / プロフィール取得
 * - Messaging API の push（テキスト / Flex）
 * - 通知ゲート（連携 + 通知設定 ON のときのみ送信）と監査ログ書き込み
 *
 * 外部 HTTP は Http::fake() でスタブ。
 */
class LineServiceTest extends TestCase
{
    private LineService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        config([
            'services.line.messaging_token'      => 'MSG_TOKEN_TEST',
            'services.line.login_channel_id'     => 'LOGIN_ID',
            'services.line.login_channel_secret' => 'LOGIN_SECRET',
            'services.line.login_redirect_uri'   => 'http://localhost/api/auth/line/callback',
        ]);
        $this->service = new LineService();
    }

    public function test_getLoginUrl_は_LINE_OAuth_URL_を組み立てる(): void
    {
        $url = $this->service->getLoginUrl('STATE_X');
        $this->assertStringStartsWith('https://access.line.me/oauth2/v2.1/authorize?', $url);
        $this->assertStringContainsString('response_type=code', $url);
        $this->assertStringContainsString('client_id=LOGIN_ID', $url);
        $this->assertStringContainsString('state=STATE_X', $url);
        $this->assertStringContainsString('scope=profile+openid', $url);
    }

    public function test_getAccessToken_成功時はjsonを返す(): void
    {
        Http::fake([
            'api.line.me/oauth2/v2.1/token' => Http::response(['access_token' => 'AT', 'id_token' => 'ID'], 200),
        ]);
        $this->assertSame(['access_token' => 'AT', 'id_token' => 'ID'], $this->service->getAccessToken('CODE'));
    }

    public function test_getAccessToken_失敗時はnullを返す(): void
    {
        Http::fake([
            'api.line.me/oauth2/v2.1/token' => Http::response(['error' => 'invalid_grant'], 400),
        ]);
        $this->assertNull($this->service->getAccessToken('BADCODE'));
    }

    public function test_getProfile_成功時はjsonを返す(): void
    {
        Http::fake([
            'api.line.me/v2/profile' => Http::response(['userId' => 'U1', 'displayName' => 'Tarou'], 200),
        ]);
        $this->assertSame(['userId' => 'U1', 'displayName' => 'Tarou'], $this->service->getProfile('AT'));
    }

    public function test_getProfile_失敗時はnullを返す(): void
    {
        Http::fake([
            'api.line.me/v2/profile' => Http::response([], 401),
        ]);
        $this->assertNull($this->service->getProfile('BAD'));
    }

    public function test_pushMessage_は_チャネルトークン未設定でfalseを返す(): void
    {
        config(['services.line.messaging_token' => '']);
        $service = new LineService();
        $this->assertFalse($service->pushMessage('U1', [['type' => 'text', 'text' => 'hi']]));
    }

    public function test_pushMessage_は_API成功でtrue_失敗でfalse(): void
    {
        Http::fake([
            'api.line.me/v2/bot/message/push' => Http::sequence()
                ->push([], 200)
                ->push(['error' => 'broken'], 500),
        ]);

        $this->assertTrue($this->service->pushMessage('U1', [['type' => 'text', 'text' => 'ok']]));
        $this->assertFalse($this->service->pushMessage('U2', [['type' => 'text', 'text' => 'ng']]));
    }

    public function test_pushText_はpushMessage経由でテキストペイロードを送る(): void
    {
        Http::fake(['api.line.me/v2/bot/message/push' => Http::response([], 200)]);

        $this->assertTrue($this->service->pushText('U1', 'hello'));

        Http::assertSent(function ($request) {
            $body = $request->data();
            return $body['to'] === 'U1'
                && $body['messages'][0]['type'] === 'text'
                && $body['messages'][0]['text'] === 'hello';
        });
    }

    public function test_pushFlex_は_flexペイロードを組み立てる(): void
    {
        Http::fake(['api.line.me/v2/bot/message/push' => Http::response([], 200)]);
        $flex = ['type' => 'bubble', 'body' => ['type' => 'box', 'layout' => 'vertical', 'contents' => []]];

        $this->assertTrue($this->service->pushFlex('U1', 'alt', $flex));

        Http::assertSent(function ($request) use ($flex) {
            $msg = $request->data()['messages'][0];
            return $msg['type'] === 'flex' && $msg['altText'] === 'alt' && $msg['contents'] === $flex;
        });
    }

    public function test_notify_は_未連携ユーザーに対してfalseを返し送信しない(): void
    {
        Http::fake();
        $user = $this->createParticipant();

        $this->assertFalse($this->service->notify($user->id, 'won_item', 'hi'));
        Http::assertNothingSent();
        $this->assertSame(0, \App\Models\LineNotificationLog::where('user_id', $user->id)->count());
    }

    public function test_notify_は_通知設定OFFなら送信しない(): void
    {
        Http::fake();
        $user = $this->createParticipant();
        LineAccount::create([
            'user_id' => $user->id,
            'line_user_id' => 'U_LINE',
            'is_active' => true,
            'linked_at' => now(),
        ]);
        LineNotificationSetting::create([
            'user_id' => $user->id,
            'notification_type' => 'won_item',
            'is_enabled' => false,
        ]);

        $this->assertFalse($this->service->notify($user->id, 'won_item', 'hi'));
        Http::assertNothingSent();
    }

    public function test_notify_成功時は_監査ログをsent状態で記録(): void
    {
        Http::fake(['api.line.me/v2/bot/message/push' => Http::response([], 200)]);
        $user = $this->createParticipant();
        LineAccount::create([
            'user_id' => $user->id,
            'line_user_id' => 'U_LINE_OK',
            'is_active' => true,
            'linked_at' => now(),
        ]);
        // 既定 ON

        $this->assertTrue($this->service->notify($user->id, 'won_item', 'hello'));
        $this->assertDatabaseHas('line_notification_logs', [
            'user_id' => $user->id,
            'notification_type' => 'won_item',
            'line_user_id' => 'U_LINE_OK',
            'status' => 'sent',
        ]);
    }

    public function test_notify_失敗時は_監査ログをfailed状態で記録(): void
    {
        Http::fake(['api.line.me/v2/bot/message/push' => Http::response(['error' => 'broken'], 500)]);
        $user = $this->createParticipant();
        LineAccount::create([
            'user_id' => $user->id,
            'line_user_id' => 'U_LINE_NG',
            'is_active' => true,
            'linked_at' => now(),
        ]);

        $this->assertFalse($this->service->notify($user->id, 'won_item', 'fail-msg'));
        $this->assertDatabaseHas('line_notification_logs', [
            'user_id' => $user->id,
            'line_user_id' => 'U_LINE_NG',
            'status' => 'failed',
        ]);
    }

    public function test_notify_は_flex指定があればflexメッセージを送る(): void
    {
        Http::fake(['api.line.me/v2/bot/message/push' => Http::response([], 200)]);
        $user = $this->createParticipant();
        LineAccount::create([
            'user_id' => $user->id,
            'line_user_id' => 'U_FLEX',
            'is_active' => true,
            'linked_at' => now(),
        ]);

        $flex = ['type' => 'bubble', 'body' => ['type' => 'box', 'layout' => 'vertical', 'contents' => []]];
        $this->assertTrue($this->service->notify($user->id, 'won_item', 'altsrc', $flex));

        Http::assertSent(fn ($req) => $req->data()['messages'][0]['type'] === 'flex');
    }
}
