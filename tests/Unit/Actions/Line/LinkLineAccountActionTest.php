<?php

namespace Tests\Unit\Actions\Line;

use App\Actions\Line\LinkLineAccountAction;
use App\Models\LineAccount;
use App\Models\User;
use App\Services\LineService;
use Tests\TestCase;

class LinkLineAccountActionTest extends TestCase
{
    private function bindLineService(?array $token, ?array $profile): void
    {
        $stub = new class($token, $profile) extends LineService {
            public function __construct(private ?array $token, private ?array $profile) {}
            public function getAccessToken(string $code): ?array
            {
                return $this->token;
            }
            public function getProfile(string $accessToken): ?array
            {
                return $this->profile;
            }
        };
        $this->app->instance(LineService::class, $stub);
    }

    public function test_新規ユーザーにLINEアカウントが作成される(): void
    {
        $user = User::factory()->create();
        $this->bindLineService(
            ['access_token' => 'tok'],
            ['userId' => 'U123abc', 'displayName' => '太郎', 'pictureUrl' => 'https://example.com/p.jpg']
        );

        $result = app(LinkLineAccountAction::class)->execute($user->id, 'auth-code');

        $this->assertInstanceOf(LineAccount::class, $result);
        $this->assertDatabaseHas('line_accounts', [
            'user_id' => $user->id,
            'line_user_id' => 'U123abc',
            'display_name' => '太郎',
            'is_active' => true,
        ]);
    }

    public function test_アクセストークン取得失敗時はnullを返す(): void
    {
        $user = User::factory()->create();
        $this->bindLineService(null, null);

        $result = app(LinkLineAccountAction::class)->execute($user->id, 'bad-code');

        $this->assertNull($result);
        $this->assertDatabaseMissing('line_accounts', ['user_id' => $user->id]);
    }

    public function test_プロフィール取得失敗時はnullを返す(): void
    {
        $user = User::factory()->create();
        $this->bindLineService(['access_token' => 'tok'], null);

        $result = app(LinkLineAccountAction::class)->execute($user->id, 'auth-code');

        $this->assertNull($result);
        $this->assertDatabaseMissing('line_accounts', ['user_id' => $user->id]);
    }

    public function test_既存連携が無効化済みなら再リンクで再有効化される(): void
    {
        $user = User::factory()->create();
        LineAccount::create([
            'user_id' => $user->id,
            'line_user_id' => 'U_OLD',
            'display_name' => '旧名',
            'picture_url' => null,
            'is_active' => false,
            'linked_at' => now()->subMonth(),
        ]);

        $this->bindLineService(
            ['access_token' => 'tok'],
            ['userId' => 'U_NEW', 'displayName' => '新名', 'pictureUrl' => 'https://example.com/new.jpg']
        );

        $result = app(LinkLineAccountAction::class)->execute($user->id, 'code');

        $this->assertNotNull($result);
        $fresh = LineAccount::where('user_id', $user->id)->first();
        $this->assertTrue($fresh->is_active);
        $this->assertSame('U_NEW', $fresh->line_user_id);
        $this->assertSame('新名', $fresh->display_name);
        // 1ユーザー1レコード
        $this->assertSame(1, LineAccount::where('user_id', $user->id)->count());
    }

    public function test_displayNameやpictureUrlが無い場合でも保存される(): void
    {
        $user = User::factory()->create();
        $this->bindLineService(
            ['access_token' => 'tok'],
            ['userId' => 'U_MIN']
        );

        $result = app(LinkLineAccountAction::class)->execute($user->id, 'code');

        $this->assertInstanceOf(LineAccount::class, $result);
        $this->assertDatabaseHas('line_accounts', [
            'user_id' => $user->id,
            'line_user_id' => 'U_MIN',
            'display_name' => null,
            'picture_url' => null,
        ]);
    }

    public function test_アクセストークンが空文字の場合はnullを返す(): void
    {
        $user = User::factory()->create();
        $this->bindLineService(['access_token' => ''], null);

        $result = app(LinkLineAccountAction::class)->execute($user->id, 'code');

        $this->assertNull($result);
    }

    public function test_userIdが空のプロフィールはnullを返す(): void
    {
        $user = User::factory()->create();
        $this->bindLineService(
            ['access_token' => 'tok'],
            ['userId' => '', 'displayName' => 'Foo']
        );

        $result = app(LinkLineAccountAction::class)->execute($user->id, 'code');

        $this->assertNull($result);
        $this->assertDatabaseMissing('line_accounts', ['user_id' => $user->id]);
    }
}
