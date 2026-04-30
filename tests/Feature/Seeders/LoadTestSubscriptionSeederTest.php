<?php

namespace Tests\Feature\Seeders;

use App\Models\Plan;
use App\Models\Role;
use App\Models\Subscription;
use App\Models\User;
use Database\Seeders\LoadTestSubscriptionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoadTestSubscriptionSeederTest extends TestCase
{
    use RefreshDatabase;

    protected function seedRoles(): void
    {
        Role::firstOrCreate(['name' => 'participant'], ['display_name' => '参加者']);
    }

    protected function makeLoadTestParticipant(int $i): User
    {
        return User::create([
            'name'              => "Test User {$i}",
            'email'             => "participant{$i}@example.com",
            'password'          => bcrypt('password'),
            'email_verified_at' => now(),
            'status'            => 'approved',
            'is_active'         => true,
        ]);
    }

    /** @test */
    public function test_既存ユーザーに対してactiveなallows_bidサブスクが付与される(): void
    {
        $this->seedRoles();
        $this->makeLoadTestParticipant(1);

        $this->seed(LoadTestSubscriptionSeeder::class);

        $user = User::where('email', 'participant1@example.com')->first();
        $sub  = Subscription::where('user_id', $user->id)->first();
        $plan = Plan::where('code', 'loadtest_full')->first();

        $this->assertNotNull($plan);
        $this->assertTrue((bool) $plan->allows_bid);
        $this->assertNotNull($sub);
        $this->assertSame(Subscription::STATUS_ACTIVE, $sub->status);
        $this->assertSame($plan->id, $sub->plan_id);
        $this->assertTrue($sub->current_period_end->isFuture());
    }

    /** @test */
    public function test_存在しないユーザーは無視されエラーにならない(): void
    {
        $this->seedRoles();
        // participant1 だけ作成。2-100 は存在しない
        $this->makeLoadTestParticipant(1);

        $this->seed(LoadTestSubscriptionSeeder::class);

        // エラーが投げられず完走することと、participant1 のみサブスク付与されることを確認
        $this->assertSame(1, Subscription::count());
    }

    /** @test */
    public function test_冪等に再実行しても既存サブスクは複製されない(): void
    {
        $this->seedRoles();
        $this->makeLoadTestParticipant(1);

        $this->seed(LoadTestSubscriptionSeeder::class);
        $this->seed(LoadTestSubscriptionSeeder::class);
        $this->seed(LoadTestSubscriptionSeeder::class);

        $this->assertSame(1, Subscription::where('user_id',
            User::where('email', 'participant1@example.com')->first()->id
        )->count());

        // Plan も1件のまま
        $this->assertSame(1, Plan::where('code', 'loadtest_full')->count());
    }

    /** @test */
    public function test_期限切れサブスクは更新される(): void
    {
        $this->seedRoles();
        $user = $this->makeLoadTestParticipant(1);

        $plan = Plan::create([
            'code'        => 'loadtest_full',
            'name'        => '旧',
            'amount'      => 0,
            'allows_bid'  => true,
            'allows_sell' => false,
            'is_active'   => true,
        ]);

        $expiredSub = Subscription::create([
            'user_id'              => $user->id,
            'plan_id'              => $plan->id,
            'status'               => Subscription::STATUS_CANCELED,
            'current_period_start' => now()->subYears(2),
            'current_period_end'   => now()->subYear(),
            'canceled_at'          => now()->subYear(),
        ]);

        $this->seed(LoadTestSubscriptionSeeder::class);

        $expiredSub->refresh();
        $this->assertSame(Subscription::STATUS_ACTIVE, $expiredSub->status);
        $this->assertNull($expiredSub->canceled_at);
        $this->assertTrue($expiredSub->current_period_end->isFuture());
    }
}
