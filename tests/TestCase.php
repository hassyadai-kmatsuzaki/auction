<?php

namespace Tests;

use App\Models\Plan;
use App\Models\Role;
use App\Models\Subscription;
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
     * 出品者ユーザーを作成（サブスクは付与しない）。
     * CheckSubscription 配下のエンドポイントを叩く場合は attachActiveSubscription を別途呼ぶ。
     */
    protected function createSeller(): User
    {
        $role = Role::firstOrCreate(['name' => 'seller']);
        $user = User::factory()->create();
        $user->roles()->attach($role->id);
        return $user;
    }

    /**
     * 買受者ユーザーを作成（サブスクは付与しない）。
     * CheckSubscription 配下のエンドポイントを叩く場合は attachActiveSubscription を別途呼ぶ。
     */
    protected function createParticipant(): User
    {
        $role = Role::firstOrCreate(['name' => 'participant']);
        $user = User::factory()->create();
        $user->roles()->attach($role->id);
        return $user;
    }

    /**
     * サブスク付きの出品者を作成
     */
    protected function createSellerWithSubscription(): User
    {
        $user = $this->createSeller();
        $this->attachActiveSubscription($user, allowsBid: false, allowsSell: true);
        return $user;
    }

    /**
     * サブスク付きの買受者を作成
     */
    protected function createParticipantWithSubscription(): User
    {
        $user = $this->createParticipant();
        $this->attachActiveSubscription($user, allowsBid: true, allowsSell: false);
        return $user;
    }

    /**
     * 任意ユーザーに active サブスクと能力フラグ付きプランを紐付ける。
     * CheckSubscription ミドルウェア配下のルートをテストから叩くためのヘルパ。
     */
    protected function attachActiveSubscription(User $user, bool $allowsBid = true, bool $allowsSell = true): Subscription
    {
        $plan = Plan::factory()->create([
            'allows_bid' => $allowsBid,
            'allows_sell' => $allowsSell,
        ]);
        return Subscription::factory()->create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => Subscription::STATUS_ACTIVE,
            'current_period_end' => now()->addYear(),
        ]);
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
