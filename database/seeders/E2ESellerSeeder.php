<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\SellerProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

/**
 * E2E 用のテスト出品者アカウントを 10 名作成する seeder。
 *
 * 本番 DB に対して安全に流せるよう、以下を遵守する:
 *   - 既存レコードは一切削除・更新しない（email 衝突時は seller_profile を repair するのみ）
 *   - email はテスト専用 prefix の決め打ち。実在ユーザーと衝突しない
 *   - 1 ユーザー = 1 トランザクション。途中で落ちても他に波及しない
 *   - DatabaseSeeder からは呼ばない。明示起動のみ:
 *       sudo -u ec2-user php artisan db:seed --class=E2ESellerSeeder
 *
 * 仕上がる状態:
 *   - users.is_test = true / status=approved / is_active=true / email_verified_at 打刻済み
 *   - seller_profiles 1件付与（seller_name, trade_name 等）
 *   - users.trade_name にも seller_name と同じ表示名を格納（落札画面の表示名はここから）
 *   - user_roles: seller 付与
 *
 * 環境変数:
 *   E2E_SELLER_COUNT          … 作成人数 (default 10)
 *   E2E_SELLER_EMAIL_PREFIX   … メールアドレス左辺の prefix (default "e2e-seller")
 *   E2E_SELLER_EMAIL_SEPARATOR … prefix と連番の間の区切り文字 (default "-")
 *   E2E_SELLER_EMAIL_DOMAIN   … ドメイン (default "medaka-test.local")
 *   E2E_SELLER_PASSWORD       … 共通パスワード (default "E2eSeller!2026")
 *   E2E_SELLER_START_INDEX    … 連番開始 (default 1)
 */
class E2ESellerSeeder extends Seeder
{
    public function run(): void
    {
        $count          = (int) (env('E2E_SELLER_COUNT', 10));
        $emailPrefix    = (string) env('E2E_SELLER_EMAIL_PREFIX', 'e2e-seller');
        $emailSeparator = (string) env('E2E_SELLER_EMAIL_SEPARATOR', '-');
        $emailDomain    = (string) env('E2E_SELLER_EMAIL_DOMAIN', 'medaka-test.local');
        $password       = (string) env('E2E_SELLER_PASSWORD', 'E2eSeller!2026');
        $startIndex     = (int) env('E2E_SELLER_START_INDEX', 1);

        if ($count <= 0) {
            throw new RuntimeException('E2E_SELLER_COUNT must be > 0');
        }

        $sellerRole = Role::where('name', 'seller')->first();
        if (!$sellerRole) {
            throw new RuntimeException('seller ロールが存在しません。先に RoleSeeder を実行してください。');
        }

        $passwordHash = Hash::make($password);

        $created = 0;
        $repaired = 0;
        $rows = [];

        for ($i = $startIndex; $i < $startIndex + $count; $i++) {
            $email      = sprintf('%s%s%03d@%s', $emailPrefix, $emailSeparator, $i, $emailDomain);
            $userName   = sprintf('E2E出品者%03d', $i);
            $sellerName = sprintf('E2Eメダカ %03d 号店', $i);
            $sellerCode = sprintf('E2E-%03d', $i);

            $existing = User::where('email', $email)->first();
            if ($existing) {
                $this->repairSeller($existing, $sellerRole, $userName, $sellerName, $sellerCode);
                $repaired++;
                $rows[] = [$existing->id, $existing->email, $sellerName, $sellerCode];
                continue;
            }

            $user = DB::transaction(function () use (
                $email, $userName, $passwordHash, $sellerRole, $sellerName, $sellerCode
            ) {
                $user = User::create([
                    'name'              => $userName,
                    'trade_name'        => $sellerName,
                    'email'             => $email,
                    'password'          => $passwordHash,
                    'email_verified_at' => now(),
                    'status'            => 'approved',
                    'approved_at'       => now(),
                    'is_active'         => true,
                    'is_test'           => true,
                    'phone'             => '090-0000-0000',
                    'postal_code'       => '100-0001',
                    'prefecture'        => '東京都',
                    'city'              => '千代田区',
                    'address_line1'     => '千代田1-1-1',
                ]);

                $user->roles()->syncWithoutDetaching([
                    $sellerRole->id => ['assigned_at' => now()],
                ]);

                SellerProfile::create([
                    'user_id'         => $user->id,
                    'seller_code'     => $sellerCode,
                    'seller_name'     => $sellerName,
                    'corporate_name'  => 'E2E株式会社',
                    'business_type'   => 'individual',
                    'contact_name'    => 'E2E 担当者',
                    'email'           => $user->email,
                    'phone'           => '090-0000-0000',
                    'postal_code'     => '100-0001',
                    'prefecture'      => '東京都',
                    'city'            => '千代田区',
                    'address_line1'   => '千代田1-1-1',
                    'commission_rate' => 10.00,
                    'is_active'       => true,
                    // 振込先（出品者支払通知書 PDF が振込先欄を埋められるようダミーを投入）
                    'bank_name'       => 'E2E銀行',
                    'bank_branch'     => sprintf('E2E支店 %03d', $i % 999),
                    'account_type'    => 'savings',
                    'account_number'  => sprintf('%07d', 1000000 + $i),
                    'account_holder'  => 'カ）イーツーイー' . $i,
                ]);

                return $user;
            });

            $created++;
            $rows[] = [$user->id, $user->email, $sellerName, $sellerCode];
        }

        $csvPath = $this->writeCsv($rows);

        $this->command->info(sprintf(
            'E2ESellerSeeder: created=%d, repaired=%d (count=%d)',
            $created, $repaired, $count
        ));
        $this->command->info(sprintf(
            'login: email=%s%s{NNN}@%s / password=%s',
            $emailPrefix, $emailSeparator, $emailDomain, $password
        ));
        $this->command->info('CSV: ' . $csvPath);
        $this->command->info('-> 続けて E2EItemSeeder に user_ids を流す:');
        $userIds = collect($rows)->pluck(0)->implode(',');
        $this->command->info('   E2E_ITEM_SELLER_USER_IDS=' . $userIds);
    }

    /**
     * 既存テスト出品者を「is_test=true + approved + seller_profile 有効 + seller ロール付与」へ揃え直す。
     * 実データを破壊しない設計のため、対象は本 seeder が作った email 帯のみ。
     */
    private function repairSeller(User $user, Role $sellerRole, string $userName, string $sellerName, string $sellerCode): void
    {
        DB::transaction(function () use ($user, $sellerRole, $userName, $sellerName, $sellerCode) {
            $user->forceFill([
                'name'              => $userName,
                'trade_name'        => $sellerName,
                'status'            => 'approved',
                'approved_at'       => $user->approved_at ?? now(),
                'is_active'         => true,
                'is_test'           => true,
                'email_verified_at' => $user->email_verified_at ?? now(),
            ])->save();

            $user->roles()->syncWithoutDetaching([
                $sellerRole->id => ['assigned_at' => now()],
            ]);

            SellerProfile::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'seller_code'     => $sellerCode,
                    'seller_name'     => $sellerName,
                    'corporate_name'  => 'E2E株式会社',
                    'business_type'   => 'individual',
                    'contact_name'    => 'E2E 担当者',
                    'email'           => $user->email,
                    'phone'           => '090-0000-0000',
                    'postal_code'     => '100-0001',
                    'prefecture'      => '東京都',
                    'city'            => '千代田区',
                    'address_line1'   => '千代田1-1-1',
                    'commission_rate' => 10.00,
                    'is_active'       => true,
                    // 振込先（出品者支払通知書 PDF が振込先欄を埋められるようダミーを投入）
                    // 連番から index を逆算する: sellerCode "E2E-NNN" の NNN を採用
                    'bank_name'       => 'E2E銀行',
                    'bank_branch'     => sprintf('E2E支店 %s', substr($sellerCode, 4)),
                    'account_type'    => 'savings',
                    'account_number'  => sprintf('%07d', 1000000 + (int) substr($sellerCode, 4)),
                    'account_holder'  => 'カ）イーツーイー' . (int) substr($sellerCode, 4),
                ]
            );
        });
    }

    /**
     * 作成した出品者一覧を CSV に書き出す。E2EItemSeeder に流す user_id 一覧の元ネタにする。
     */
    private function writeCsv(array $rows): string
    {
        $dir = storage_path('app');
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $path = $dir . '/e2e-sellers-' . now()->format('Ymd-His') . '.csv';

        $fp = fopen($path, 'w');
        if ($fp === false) {
            throw new RuntimeException('CSV ファイルを開けませんでした: ' . $path);
        }
        fwrite($fp, "\xEF\xBB\xBF"); // UTF-8 BOM
        fputcsv($fp, ['user_id', 'email', 'seller_name', 'seller_code']);
        foreach ($rows as $row) {
            fputcsv($fp, $row);
        }
        fclose($fp);

        return $path;
    }
}
