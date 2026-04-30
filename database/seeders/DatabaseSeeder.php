<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     *
     * - RoleSeeder は冪等で全環境で実行する。
     * - AdminUserSeeder は弱パスワードの固定アカウントを作るため production ではスキップ。
     */
    public function run(): void
    {
        $this->call([RoleSeeder::class]);

        if (app()->environment('production')) {
            $this->command?->info('production 環境のため AdminUserSeeder をスキップしました。');
            return;
        }

        $this->call([AdminUserSeeder::class]);
    }

    /**
     * デモデータを含む完全なシードを実行
     * 使用方法: php artisan db:seed --class=DatabaseSeeder
     * または: php artisan db:seed --class=DemoDataSeeder
     */
    public function runWithDemoData(): void
    {
        $this->call([
            RoleSeeder::class,
            DemoDataSeeder::class,
        ]);
    }
}
