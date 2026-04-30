<?php

namespace Tests\Feature\Seeders;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoDataSeeder;
use Database\Seeders\PostAuctionE2ESeeder;
use Database\Seeders\ShippingPatternsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * 破壊的 / 弱認証情報を作る Seeder が production 環境で abort することを保証するテスト。
 *
 * Laravel の `app()->environment()` は内部的に `$this['env']` を返すので、
 * テスト中に `$this->app->detectEnvironment(fn() => 'production')` で
 * production 相当に切り替えてから run() を呼ぶ。
 */
class SeederProductionGuardTest extends TestCase
{
    use RefreshDatabase;

    private function asProduction(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        $this->assertSame('production', app()->environment());
    }

    /** @test */
    public function test_DemoDataSeederはproductionでabortする(): void
    {
        $this->asProduction();

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/DemoDataSeeder.*production/');

        $seeder = new DemoDataSeeder();
        $seeder->setCommand(new \Illuminate\Console\Command());
        $seeder->run();
    }

    /** @test */
    public function test_ShippingPatternsSeederはproductionでabortする(): void
    {
        $this->asProduction();

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/ShippingPatternsSeeder.*production/');

        $seeder = new ShippingPatternsSeeder();
        $seeder->setCommand(new \Illuminate\Console\Command());
        $seeder->run();
    }

    /** @test */
    public function test_PostAuctionE2ESeederはproductionでabortする(): void
    {
        $this->asProduction();

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/PostAuctionE2ESeeder.*production/');

        $seeder = new PostAuctionE2ESeeder();
        $seeder->setCommand(new \Illuminate\Console\Command());
        $seeder->run();
    }

    /** @test */
    public function test_AdminUserSeederはproductionでabortする(): void
    {
        $this->asProduction();

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/AdminUserSeeder.*production/');

        $seeder = new AdminUserSeeder();
        $seeder->setCommand(new \Illuminate\Console\Command());
        $seeder->run();
    }

    /** @test */
    public function test_DatabaseSeederはproductionでAdminUserSeederをスキップする(): void
    {
        $this->asProduction();

        // Laravel 12 の $this->seed() は --no-interaction 渡しで --force を渡さないため
        // production env だと confirm prompt に詰まる。ここでは --force つきで Artisan::call。
        \Illuminate\Support\Facades\Artisan::call('db:seed', [
            '--class' => DatabaseSeeder::class,
            '--force' => true,
        ]);

        // Role は冪等に作られている
        $this->assertSame(3, Role::count());
        // admin / participant / seller は作られていない
        $this->assertSame(0, User::where('email', 'admin@example.com')->count());
        $this->assertSame(0, User::where('email', 'participant@example.com')->count());
        $this->assertSame(0, User::where('email', 'seller@example.com')->count());
    }

    /** @test */
    public function test_DatabaseSeederは非productionでAdminUserSeederも実行する(): void
    {
        // testing 環境のまま実行
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(3, Role::count());
        $this->assertSame(1, User::where('email', 'admin@example.com')->count());
    }
}
