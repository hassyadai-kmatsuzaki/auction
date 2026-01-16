<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $roles = [
            [
                'name' => 'admin',
                'display_name' => '管理者',
                'description' => 'システム管理者。すべての機能にアクセス可能。',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'seller',
                'display_name' => '出品者',
                'description' => '商品を出品できるユーザー。',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'participant',
                'display_name' => '参加者',
                'description' => 'オークションに参加して入札できるユーザー。',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        foreach ($roles as $role) {
            DB::table('roles')->insertOrIgnore($role);
        }

        $this->command->info('ロールを作成しました。');
    }
}
