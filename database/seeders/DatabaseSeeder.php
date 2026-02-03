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
     */
    public function run(): void
    {
        // ロールを作成
        $this->call([
            RoleSeeder::class,
            AdminUserSeeder::class,
        ]);
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
