<?php

namespace Tests;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // テスト時のログを /tmp に書き出して storage のパーミッションエラーを防ぐ
        Config::set('logging.channels.single.path', sys_get_temp_dir() . '/laravel-test.log');
        Config::set('logging.default', 'single');
    }

    /**
     * 管理者ユーザーを作成
     */
    protected function createAdmin(): User
    {
        $role = Role::firstOrCreate(['name' => 'admin']);
        $user = User::factory()->create();
        $user->roles()->attach($role->id);
        return $user;
    }

    /**
     * 出品者ユーザーを作成
     */
    protected function createSeller(): User
    {
        $role = Role::firstOrCreate(['name' => 'seller']);
        $user = User::factory()->create();
        $user->roles()->attach($role->id);
        return $user;
    }

    /**
     * 買受者ユーザーを作成
     */
    protected function createParticipant(): User
    {
        $role = Role::firstOrCreate(['name' => 'participant']);
        $user = User::factory()->create();
        $user->roles()->attach($role->id);
        return $user;
    }

    /**
     * 全ロールを作成
     */
    protected function seedRoles(): void
    {
        Role::firstOrCreate(['name' => 'admin'], ['display_name' => '管理者']);
        Role::firstOrCreate(['name' => 'seller'], ['display_name' => '出品者']);
        Role::firstOrCreate(['name' => 'participant'], ['display_name' => '買受者']);
    }
}
