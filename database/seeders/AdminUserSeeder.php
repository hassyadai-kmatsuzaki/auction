<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * 開発・staging 環境で初期テストユーザーを投入する Seeder。
 *
 * ⚠ 本番実行不可:
 *   - 固定メールアドレス (admin@example.com / participant@example.com / seller@example.com)
 *     を弱パスワード `password` で作成するため、production で実行するとセキュリティ事故。
 *   - 旧版は `User::create()` をそのまま叩いていたため、再実行で UNIQUE constraint エラー。
 *
 * 本版の改修:
 *   1. production では abort
 *   2. firstOrCreate で冪等化（既存ユーザーは触らない）
 *   3. 既存ユーザーへのロール割り当ても重複防止
 *   4. パスワードは ADMIN_INITIAL_PASSWORD env から取得可、未設定なら `password`
 */
class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            throw new \RuntimeException(
                'AdminUserSeeder は弱パスワードの固定アカウント（admin@example.com 等）を '
                . '作成するため production では実行できません。'
                . ' 本番の admin 作成は別途運用手順で行ってください。'
            );
        }

        $password = env('ADMIN_INITIAL_PASSWORD', 'password');
        $hashed = Hash::make($password);

        $adminRole       = Role::where('name', 'admin')->first();
        $sellerRole      = Role::where('name', 'seller')->first();
        $participantRole = Role::where('name', 'participant')->first();

        // ─── admin@example.com（admin / seller / participant 全ロール）──
        $admin = User::firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name'              => 'システム管理者',
                'password'          => $hashed,
                'status'            => 'approved',
                'approved_at'       => now(),
                'email_verified_at' => now(),
                'is_active'         => true,
            ]
        );
        $this->attachRoleIfMissing($admin, $adminRole);
        $this->attachRoleIfMissing($admin, $sellerRole);
        $this->attachRoleIfMissing($admin, $participantRole);
        $this->command->info(($admin->wasRecentlyCreated ? '作成: ' : '既存: ') . 'admin@example.com');

        // ─── participant@example.com ────────────────────────────
        $participant = User::firstOrCreate(
            ['email' => 'participant@example.com'],
            [
                'name'              => '参加者テスト',
                'password'          => $hashed,
                'status'            => 'approved',
                'approved_at'       => now(),
                'email_verified_at' => now(),
                'is_active'         => true,
            ]
        );
        $this->attachRoleIfMissing($participant, $participantRole);
        $this->command->info(($participant->wasRecentlyCreated ? '作成: ' : '既存: ') . 'participant@example.com');

        // ─── seller@example.com（seller + participant）─────────
        $seller = User::firstOrCreate(
            ['email' => 'seller@example.com'],
            [
                'name'              => '出品者テスト',
                'password'          => $hashed,
                'status'            => 'approved',
                'approved_at'       => now(),
                'email_verified_at' => now(),
                'is_active'         => true,
            ]
        );
        $this->attachRoleIfMissing($seller, $sellerRole);
        $this->attachRoleIfMissing($seller, $participantRole);
        $this->command->info(($seller->wasRecentlyCreated ? '作成: ' : '既存: ') . 'seller@example.com');

        $this->command->info('初期パスワード: ' . $password);
    }

    private function attachRoleIfMissing(User $user, ?Role $role): void
    {
        if (!$role) {
            return;
        }
        if ($user->roles()->where('role_id', $role->id)->exists()) {
            return;
        }
        $user->roles()->attach($role->id, ['assigned_at' => now()]);
    }
}
