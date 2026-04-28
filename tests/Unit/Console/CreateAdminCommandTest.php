<?php

namespace Tests\Unit\Console;

use App\Models\Role;
use App\Models\User;
use Tests\TestCase;

class CreateAdminCommandTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
    }

    public function test_command_creates_admin_user_with_role(): void
    {
        $this->artisan('app:create-admin')
            ->expectsQuestion('名前', '管理者太郎')
            ->expectsQuestion('メールアドレス', 'newadmin@example.com')
            ->expectsQuestion('パスワード', 'Sup3rSecret!')
            ->expectsQuestion('パスワード（確認）', 'Sup3rSecret!')
            ->expectsOutputToContain('管理者アカウントを作成しました')
            ->assertExitCode(0);

        $user = User::where('email', 'newadmin@example.com')->first();
        $this->assertNotNull($user);
        $this->assertSame('管理者太郎', $user->name);
        $this->assertSame('approved', $user->status);

        $adminRoleId = Role::where('name', 'admin')->value('id');
        $this->assertDatabaseHas('user_roles', [
            'user_id' => $user->id,
            'role_id' => $adminRoleId,
        ]);
    }

    public function test_command_fails_with_duplicate_email(): void
    {
        // 既存ユーザー
        User::factory()->create(['email' => 'dup@example.com']);

        $this->artisan('app:create-admin')
            ->expectsQuestion('名前', '太郎')
            ->expectsQuestion('メールアドレス', 'dup@example.com')
            ->expectsQuestion('パスワード', 'Sup3rSecret!')
            ->expectsQuestion('パスワード（確認）', 'Sup3rSecret!')
            ->expectsOutputToContain('入力エラー')
            ->assertExitCode(1);
    }

    public function test_command_fails_with_password_mismatch(): void
    {
        $this->artisan('app:create-admin')
            ->expectsQuestion('名前', '太郎')
            ->expectsQuestion('メールアドレス', 'a@example.com')
            ->expectsQuestion('パスワード', 'Sup3rSecret!')
            ->expectsQuestion('パスワード（確認）', 'Different123!')
            ->expectsOutputToContain('入力エラー')
            ->assertExitCode(1);

        $this->assertDatabaseMissing('users', ['email' => 'a@example.com']);
    }

    public function test_command_fails_with_short_password(): void
    {
        $this->artisan('app:create-admin')
            ->expectsQuestion('名前', '太郎')
            ->expectsQuestion('メールアドレス', 'b@example.com')
            ->expectsQuestion('パスワード', 'short')
            ->expectsQuestion('パスワード（確認）', 'short')
            ->expectsOutputToContain('入力エラー')
            ->assertExitCode(1);
    }

    public function test_command_fails_with_invalid_email(): void
    {
        $this->artisan('app:create-admin')
            ->expectsQuestion('名前', '太郎')
            ->expectsQuestion('メールアドレス', 'not-an-email')
            ->expectsQuestion('パスワード', 'Sup3rSecret!')
            ->expectsQuestion('パスワード（確認）', 'Sup3rSecret!')
            ->expectsOutputToContain('入力エラー')
            ->assertExitCode(1);
    }
}
