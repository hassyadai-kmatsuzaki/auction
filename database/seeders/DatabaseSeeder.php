<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * 標準シードのエントリポイント。
 *
 * 残存する Seeder は次の3つのみ:
 *   - RoleSeeder           : admin / seller / participant の3ロール (冪等)
 *   - SystemSettingsSeeder : system_settings の初期値 (冪等)
 *   - DatabaseSeeder       : 本クラス自身
 *
 * 過去にあった AdminUserSeeder / DemoDataSeeder / E2EStagingSeeder /
 * PostAuctionE2ESeeder / ShippingPatternsSeeder / LoadTestSubscriptionSeeder は
 * 削除済み。負荷テスト・E2E テスト用のデータ投入は手動 (tinker / SQL) で行う。
 */
class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     *
     * 全環境で安全に実行可。RoleSeeder のみ呼び出す（冪等）。
     */
    public function run(): void
    {
        $this->call([RoleSeeder::class]);
    }
}
