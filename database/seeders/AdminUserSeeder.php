<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 管理者アカウントを作成
        $admin = User::create([
            'name' => 'システム管理者',
            'email' => 'admin@example.com',
            'password' => Hash::make('password'),
            'status' => 'approved',
            'approved_at' => now(),
            'email_verified_at' => now(),
            'is_active' => true,
        ]);

        // admin ロールを付与
        $adminRole = Role::where('name', 'admin')->first();
        $admin->roles()->attach($adminRole->id, [
            'assigned_at' => now(),
        ]);

        $this->command->info('管理者アカウントを作成しました。');
        $this->command->info('メール: admin@example.com');
        $this->command->info('パスワード: password');

        // テスト用の参加者アカウント
        $participant = User::create([
            'name' => '参加者テスト',
            'email' => 'participant@example.com',
            'password' => Hash::make('password'),
            'status' => 'approved',
            'approved_at' => now(),
            'email_verified_at' => now(),
            'is_active' => true,
        ]);

        $participantRole = Role::where('name', 'participant')->first();
        $participant->roles()->attach($participantRole->id, [
            'assigned_at' => now(),
        ]);

        $this->command->info('参加者アカウントを作成しました。');
        $this->command->info('メール: participant@example.com');
        $this->command->info('パスワード: password');

        // テスト用の出品者アカウント（出品者+参加者の両方）
        $seller = User::create([
            'name' => '出品者テスト',
            'email' => 'seller@example.com',
            'password' => Hash::make('password'),
            'status' => 'approved',
            'approved_at' => now(),
            'email_verified_at' => now(),
            'is_active' => true,
        ]);

        $sellerRole = Role::where('name', 'seller')->first();
        $seller->roles()->attach($sellerRole->id, [
            'assigned_at' => now(),
        ]);
        $seller->roles()->attach($participantRole->id, [
            'assigned_at' => now(),
        ]);

        $this->command->info('出品者アカウントを作成しました（参加者権限も付与）。');
        $this->command->info('メール: seller@example.com');
        $this->command->info('パスワード: password');
    }
}
