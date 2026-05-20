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
 * ShippingPatternsSeeder / LoadTestSubscriptionSeeder は削除済み。
 *
 * E2E 一連 (DatabaseSeeder からは呼ばれない、明示起動のみ):
 *   - E2EAuctionSeeder      : is_test=true のテスト用 auction + lanes を作成
 *   - E2ESellerSeeder       : テスト出品者を 10 名作成
 *   - E2EItemSeeder         : 上記出品者の items を最大 200 件作成 + lanes 割当
 *   - E2EBidderSeeder       : テスト落札候補ユーザーを 100 名作成（全11リージョン分散）
 *   - PostAuctionE2ESeeder  : 上記 auction を「落札確定後」状態へ進める
 *                             (won_items / 配送料計算 / seller_settlements まで投入)
 *
 * 負荷テスト用のデータ投入は手動 (tinker / SQL) で行う。
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
