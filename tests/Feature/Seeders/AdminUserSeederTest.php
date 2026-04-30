<?php

namespace Tests\Feature\Seeders;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminUserSeederTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    /** @test */
    public function test_初回実行でadmin_participant_seller_3アカウントが作成される(): void
    {
        $this->seed(AdminUserSeeder::class);

        $this->assertSame(1, User::where('email', 'admin@example.com')->count());
        $this->assertSame(1, User::where('email', 'participant@example.com')->count());
        $this->assertSame(1, User::where('email', 'seller@example.com')->count());

        $admin = User::where('email', 'admin@example.com')->first();
        $this->assertSame('approved', $admin->status);
        $this->assertNotNull($admin->approved_at);
        $this->assertTrue((bool) $admin->is_active);

        // ロールが付与されている
        $this->assertSame(3, $admin->roles()->count(), 'admin は admin/seller/participant 全付与');
        $this->assertSame(1, User::where('email', 'participant@example.com')->first()->roles()->count());
        $this->assertSame(2, User::where('email', 'seller@example.com')->first()->roles()->count());
    }

    /** @test */
    public function test_冪等に複数回実行してもユーザーやロールが重複しない(): void
    {
        $this->seed(AdminUserSeeder::class);
        $this->seed(AdminUserSeeder::class);
        $this->seed(AdminUserSeeder::class);

        $this->assertSame(3, User::count(), 'admin/participant/seller の3名のみ');

        $admin = User::where('email', 'admin@example.com')->first();
        $this->assertSame(3, $admin->roles()->count(), 'admin のロールが重複付与されない');

        $seller = User::where('email', 'seller@example.com')->first();
        $this->assertSame(2, $seller->roles()->count(), 'seller のロールが重複付与されない');
    }

    /** @test */
    public function test_ADMIN_INITIAL_PASSWORD環境変数が反映される(): void
    {
        putenv('ADMIN_INITIAL_PASSWORD=ChangeMe!2026');
        try {
            $this->seed(AdminUserSeeder::class);
            $admin = User::where('email', 'admin@example.com')->first();
            $this->assertTrue(Hash::check('ChangeMe!2026', $admin->password));
        } finally {
            putenv('ADMIN_INITIAL_PASSWORD'); // unset
        }
    }

    /** @test */
    public function test_既存のadminユーザーが書き換えられない(): void
    {
        // 既存の admin（パスワード変更済み）が存在
        $existing = User::create([
            'name'              => '実運用 admin',
            'email'             => 'admin@example.com',
            'password'          => Hash::make('ProductionPassword!'),
            'status'            => 'approved',
            'approved_at'       => now(),
            'email_verified_at' => now(),
            'is_active'         => true,
        ]);

        $this->seed(AdminUserSeeder::class);

        $existing->refresh();
        $this->assertSame('実運用 admin', $existing->name, '既存の name は維持される');
        $this->assertTrue(Hash::check('ProductionPassword!', $existing->password), '既存の password は維持される');
    }
}
