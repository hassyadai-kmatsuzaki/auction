<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Models\Role;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class CreateAdminCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:create-admin';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = '管理者アカウントを作成します';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('管理者アカウントを作成します');
        $this->newLine();

        // 入力
        $name = $this->ask('名前');
        $email = $this->ask('メールアドレス');
        $password = $this->secret('パスワード');
        $passwordConfirmation = $this->secret('パスワード（確認）');

        // バリデーション
        $validator = Validator::make([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'password_confirmation' => $passwordConfirmation,
        ], [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            $this->error('入力エラー:');
            foreach ($validator->errors()->all() as $error) {
                $this->error('  ' . $error);
            }
            return 1;
        }

        DB::beginTransaction();
        try {
            // ユーザー作成
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($password),
                'status' => 'approved',
                'approved_at' => now(),
                'email_verified_at' => now(),
                'is_active' => true,
            ]);

            // admin ロールを付与
            $adminRole = Role::where('name', 'admin')->firstOrFail();
            $user->roles()->attach($adminRole->id, [
                'assigned_at' => now(),
            ]);

            DB::commit();

            $this->newLine();
            $this->info('✓ 管理者アカウントを作成しました');
            $this->table(
                ['項目', '値'],
                [
                    ['名前', $user->name],
                    ['メール', $user->email],
                    ['ロール', 'admin'],
                    ['ステータス', $user->status],
                ]
            );

            return 0;
        } catch (\Exception $e) {
            DB::rollBack();
            $this->error('エラーが発生しました: ' . $e->getMessage());
            return 1;
        }
    }
}
