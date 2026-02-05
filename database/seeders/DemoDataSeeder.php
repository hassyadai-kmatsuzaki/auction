<?php

namespace Database\Seeders;

use App\Models\Announcement;
use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\Role;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use App\Models\SystemSetting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DemoDataSeeder extends Seeder
{
    // 作成件数の設定
    private int $sellerCount = 30;        // 出品者数
    private int $participantCount = 100;   // 買受者数
    private int $auctionCount = 25;        // オークション数
    private int $itemsPerAuction = 200;    // オークションあたりのアイテム数（合計約5000件）

    /**
     * デモデータを作成
     */
    public function run(): void
    {
        $this->command->info('デモデータの作成を開始します...');
        $this->command->info("設定: 出品者{$this->sellerCount}名, 買受者{$this->participantCount}名, オークション{$this->auctionCount}件, アイテム約" . ($this->auctionCount * $this->itemsPerAuction) . "件");

        // 既存データをクリア（外部キー制約を一時的に無効化）
        $driver = DB::getDriverName();
        
        if ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
        } elseif ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = OFF');
        }
        
        WonItem::truncate();
        DB::table('lane_items')->truncate();
        Item::truncate();
        Lane::truncate();
        Auction::truncate();
        Announcement::truncate();
        SellerProfile::truncate();
        DB::table('user_roles')->truncate();
        User::where('email', '!=', 'admin@example.com')->delete();
        
        if ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        } elseif ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON');
        }

        // ロールの確認
        $this->ensureRolesExist();

        // システム設定
        $this->seedSystemSettings();

        // ユーザー作成
        $admin = $this->seedAdminUser();
        $sellers = $this->seedSellers();
        $participants = $this->seedParticipants();

        // お知らせ作成
        $this->seedAnnouncements($admin);

        // オークション作成
        $auctions = $this->seedAuctions($admin);

        // 生体（アイテム）作成
        $this->seedItems($auctions, $sellers);

        // 落札データ作成（終了済みオークションのみ）
        $this->seedWonItems($participants);

        $this->command->info('デモデータの作成が完了しました！');
    }

    /**
     * ロールの存在確認
     */
    private function ensureRolesExist(): void
    {
        $roles = ['admin', 'seller', 'participant'];
        foreach ($roles as $roleName) {
            Role::firstOrCreate(['name' => $roleName]);
        }
        $this->command->info('✓ ロール確認完了');
    }

    /**
     * システム設定
     */
    private function seedSystemSettings(): void
    {
        $settings = [
            ['category' => 'auction', 'setting_key' => 'price_increment_rate', 'setting_value' => '10', 'value_type' => 'integer', 'display_name' => '価格上昇率', 'description' => '価格上昇率（%）'],
            ['category' => 'auction', 'setting_key' => 'price_increment_min', 'setting_value' => '50', 'value_type' => 'integer', 'display_name' => '最低上昇金額', 'description' => '最低上昇金額（円）'],
            ['category' => 'auction', 'setting_key' => 'countdown_seconds', 'setting_value' => '3', 'value_type' => 'integer', 'display_name' => 'カウントダウン秒数', 'description' => 'カウントダウン秒数'],
            ['category' => 'auction', 'setting_key' => 'auto_extend_seconds', 'setting_value' => '10', 'value_type' => 'integer', 'display_name' => '自動延長秒数', 'description' => '自動延長秒数'],
            ['category' => 'auction', 'setting_key' => 'default_lane_count', 'setting_value' => '6', 'value_type' => 'integer', 'display_name' => 'デフォルトレーン数', 'description' => '最大レーン数'],
            ['category' => 'auction', 'setting_key' => 'default_bid_increment', 'setting_value' => '100', 'value_type' => 'integer', 'display_name' => 'デフォルト入札単位', 'description' => 'デフォルト入札単位（円）'],
            ['category' => 'fee', 'setting_key' => 'default_commission_rate', 'setting_value' => '10', 'value_type' => 'decimal', 'display_name' => '出品者販売手数料率', 'description' => '出品者販売手数料率（%）'],
            ['category' => 'fee', 'setting_key' => 'seller_commission_min', 'setting_value' => '500', 'value_type' => 'integer', 'display_name' => '出品者最低手数料', 'description' => '出品者最低手数料（円）'],
            ['category' => 'fee', 'setting_key' => 'buyer_commission_rate', 'setting_value' => '5', 'value_type' => 'decimal', 'display_name' => '買受者落札手数料率', 'description' => '買受者落札手数料率（%）'],
            ['category' => 'fee', 'setting_key' => 'buyer_commission_min', 'setting_value' => '300', 'value_type' => 'integer', 'display_name' => '買受者最低手数料', 'description' => '買受者最低手数料（円）'],
            ['category' => 'fee', 'setting_key' => 'base_listing_fee', 'setting_value' => '500', 'value_type' => 'integer', 'display_name' => '基本出品料', 'description' => '基本出品料（円）'],
            ['category' => 'fee', 'setting_key' => 'premium_plan_fee', 'setting_value' => '800', 'value_type' => 'integer', 'display_name' => 'プレミアム出品料', 'description' => 'プレミアム出品料（円）'],
            ['category' => 'shipping', 'setting_key' => 'packaging_fee', 'setting_value' => '500', 'value_type' => 'integer', 'display_name' => '梱包料金', 'description' => '梱包料金（円）'],
            ['category' => 'shipping', 'setting_key' => 'handling_fee', 'setting_value' => '300', 'value_type' => 'integer', 'display_name' => '取扱手数料', 'description' => '取扱手数料（円）'],
            ['category' => 'shipping', 'setting_key' => 'insurance_fee_rate', 'setting_value' => '3', 'value_type' => 'decimal', 'display_name' => '保険料率', 'description' => '保険料率（%）'],
            ['category' => 'shipping', 'setting_key' => 'cooling_fee_summer', 'setting_value' => '300', 'value_type' => 'integer', 'display_name' => '夏季クール便料金', 'description' => '夏季クール便料金（円）'],
            ['category' => 'shipping', 'setting_key' => 'heating_fee_winter', 'setting_value' => '300', 'value_type' => 'integer', 'display_name' => '冬季保温料金', 'description' => '冬季保温料金（円）'],
            [
                'category' => 'shipping',
                'setting_key' => 'shipping_rates',
                'setting_value' => json_encode([
                    ['region' => '関東', 'size_60' => 800, 'size_80' => 1000, 'size_100' => 1200],
                    ['region' => '関西', 'size_60' => 900, 'size_80' => 1100, 'size_100' => 1300],
                    ['region' => '北海道', 'size_60' => 1500, 'size_80' => 1800, 'size_100' => 2100],
                    ['region' => '九州', 'size_60' => 1200, 'size_80' => 1400, 'size_100' => 1600],
                    ['region' => '沖縄', 'size_60' => 2000, 'size_80' => 2500, 'size_100' => 3000],
                ]),
                'value_type' => 'json',
                'display_name' => '地域別配送料金',
                'description' => '地域別配送料金',
            ],
        ];

        foreach ($settings as $setting) {
            SystemSetting::updateOrCreate(
                ['setting_key' => $setting['setting_key']],
                [
                    'category' => $setting['category'],
                    'setting_value' => $setting['setting_value'],
                    'value_type' => $setting['value_type'],
                    'display_name' => $setting['display_name'],
                    'description' => $setting['description'],
                    'is_public' => false,
                ]
            );
        }

        $this->command->info('✓ システム設定完了');
    }

    /**
     * 管理者ユーザー作成
     */
    private function seedAdminUser(): User
    {
        $admin = User::firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => '管理者',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        $adminRole = Role::where('name', 'admin')->first();
        if ($adminRole && !$admin->roles()->where('role_id', $adminRole->id)->exists()) {
            $admin->roles()->attach($adminRole->id);
        }

        $this->command->info('✓ 管理者ユーザー作成完了: admin@example.com');
        return $admin;
    }

    /**
     * 出品者ユーザー作成
     */
    private function seedSellers(): array
    {
        $sellerRole = Role::where('name', 'seller')->first();
        $sellers = [];

        $lastNames = ['山田', '佐藤', '鈴木', '田中', '高橋', '渡辺', '伊藤', '中村', '小林', '加藤', '吉田', '山本', '松本', '井上', '木村'];
        $shopSuffixes = ['養殖場', 'ブリーダー', '水産', 'ファーム', 'ペット', 'アクア', '爬虫類専門店', 'レプタイルズ'];
        $prefectures = ['北海道', '東京都', '神奈川県', '大阪府', '愛知県', '福岡県', '広島県', '宮城県', '新潟県', '埼玉県'];
        $bankNames = ['みずほ銀行', '三菱UFJ銀行', '三井住友銀行', 'りそな銀行', 'ゆうちょ銀行'];

        $hashedPassword = Hash::make('password');

        for ($i = 1; $i <= $this->sellerCount; $i++) {
            $lastName = $lastNames[array_rand($lastNames)];
            $shopSuffix = $shopSuffixes[array_rand($shopSuffixes)];
            $shopName = $lastName . $shopSuffix;
            $prefecture = $prefectures[array_rand($prefectures)];

            $user = User::create([
                'name' => $shopName,
                'email' => "seller{$i}@example.com",
                'password' => $hashedPassword,
                'email_verified_at' => now(),
                'status' => 'approved',
                'is_active' => true,
            ]);

            if ($sellerRole) {
                $user->roles()->attach($sellerRole->id);
            }

            $profile = SellerProfile::create([
                'user_id' => $user->id,
                'seller_code' => sprintf('S%03d', $i),
                'seller_name' => $shopName,
                'contact_name' => $lastName . ['太郎', '花子', '一郎', '次郎', '三郎'][rand(0, 4)],
                'email' => "seller{$i}@example.com",
                'phone' => sprintf('0%d-%04d-%04d', rand(3, 9), rand(1000, 9999), rand(1000, 9999)),
                'postal_code' => sprintf('%03d-%04d', rand(100, 999), rand(0, 9999)),
                'prefecture' => $prefecture,
                'city' => $prefecture === '東京都' ? ['渋谷区', '新宿区', '港区', '品川区'][rand(0, 3)] : '中央区',
                'address_line1' => '1-' . rand(1, 30) . '-' . rand(1, 30),
                'bank_name' => $bankNames[array_rand($bankNames)],
                'bank_branch' => ['渋谷', '新宿', '大阪', '名古屋', '本店'][rand(0, 4)] . '支店',
                'account_type' => 'savings',
                'account_number' => sprintf('%07d', rand(1000000, 9999999)),
                'account_holder' => $lastName . ['太郎', '花子', '一郎'][rand(0, 2)],
                'is_active' => true,
            ]);

            $sellers[] = ['user' => $user, 'profile' => $profile];

            if ($i % 10 === 0) {
                $this->command->info("  出品者作成中: {$i}/{$this->sellerCount}");
            }
        }

        $this->command->info('✓ 出品者ユーザー作成完了: ' . count($sellers) . '名');
        return $sellers;
    }

    /**
     * 買受者ユーザー作成
     */
    private function seedParticipants(): array
    {
        $participantRole = Role::where('name', 'participant')->first();
        $participants = [];

        $lastNames = ['田中', '高橋', '伊藤', '渡辺', '中村', '小林', '加藤', '吉田', '山本', '松本', '井上', '木村', '清水', '林', '斉藤'];
        $firstNames = ['健一', '美咲', '大輔', '由美', '翔太', '愛', '隆', '直樹', '裕子', '和也', '真由美', '拓也', '千尋', '誠', '恵'];

        $hashedPassword = Hash::make('password');

        for ($i = 1; $i <= $this->participantCount; $i++) {
            $lastName = $lastNames[array_rand($lastNames)];
            $firstName = $firstNames[array_rand($firstNames)];

            $user = User::create([
                'name' => $lastName . $firstName,
                'email' => "participant{$i}@example.com",
                'password' => $hashedPassword,
                'email_verified_at' => now(),
                'status' => 'approved',
                'is_active' => true,
            ]);

            if ($participantRole) {
                $user->roles()->attach($participantRole->id);
            }

            $participants[] = $user;

            if ($i % 20 === 0) {
                $this->command->info("  買受者作成中: {$i}/{$this->participantCount}");
            }
        }

        $this->command->info('✓ 買受者ユーザー作成完了: ' . count($participants) . '名');
        return $participants;
    }

    /**
     * お知らせ作成
     */
    private function seedAnnouncements(User $admin): void
    {
        $announcements = [
            [
                'title' => '【重要】システムメンテナンスのお知らせ',
                'content' => "平素より当サービスをご利用いただき、誠にありがとうございます。\n\n下記の日程でシステムメンテナンスを実施いたします。",
                'target_roles' => ['admin', 'seller', 'participant'],
                'is_important' => true,
                'status' => 'published',
                'published_at' => now()->subDays(3),
            ],
            [
                'title' => '新機能リリースのお知らせ',
                'content' => "いつも当サービスをご利用いただき、ありがとうございます。\n\nこの度、以下の新機能をリリースいたしました。",
                'target_roles' => ['participant'],
                'is_important' => false,
                'status' => 'published',
                'published_at' => now()->subDays(1),
            ],
            [
                'title' => '出品者向け：手数料改定のお知らせ',
                'content' => "出品者の皆様へ\n\n手数料体系を一部改定いたします。",
                'target_roles' => ['seller'],
                'is_important' => false,
                'status' => 'published',
                'published_at' => now(),
            ],
        ];

        foreach ($announcements as $data) {
            Announcement::create([
                'title' => $data['title'],
                'content' => $data['content'],
                'target_roles' => $data['target_roles'],
                'is_important' => $data['is_important'],
                'status' => $data['status'],
                'published_at' => $data['published_at'],
                'created_by' => $admin->id,
            ]);
        }

        $this->command->info('✓ お知らせ作成完了: ' . count($announcements) . '件');
    }

    /**
     * オークション作成
     */
    private function seedAuctions(User $admin): array
    {
        $auctions = [];

        $titles = [
            '爬虫類オークション',
            '希少種特別オークション',
            '週末定期オークション',
            'レオパ・ボールパイソン専門オークション',
            '初心者向けオークション',
            'プレミアムオークション',
            '大感謝祭オークション',
            '春の特別オークション',
            '夏の爬虫類祭り',
            '秋の収穫祭オークション',
        ];

        $descriptions = [
            '厳選された個体を多数出品！',
            '希少種を中心とした特別オークションです。',
            '毎週開催の定期オークションです。',
            '人気種を集めました。',
            '初心者の方も安心してご参加いただけます。',
        ];

        // 過去・現在・未来のオークションをバランスよく作成
        for ($i = 1; $i <= $this->auctionCount; $i++) {
            // ステータスと日付を決定
            if ($i <= floor($this->auctionCount * 0.4)) {
                // 40%は終了済み
                $status = 'finished';
                $eventDate = now()->subDays(rand(7, 90))->format('Y-m-d');
            } elseif ($i <= floor($this->auctionCount * 0.5)) {
                // 10%は準備中
                $status = 'preparing';
                $eventDate = now()->addDays(rand(1, 7))->format('Y-m-d');
            } else {
                // 50%は予定
                $status = 'scheduled';
                $eventDate = now()->addDays(rand(7, 60))->format('Y-m-d');
            }

            $laneCount = rand(3, 8);

            $auction = Auction::create([
                'title' => "第{$i}回 " . $titles[($i - 1) % count($titles)],
                'event_date' => $eventDate,
                'start_time' => ['10:00:00', '13:00:00', '14:00:00', '19:00:00'][rand(0, 3)],
                'status' => $status,
                'description' => $descriptions[($i - 1) % count($descriptions)],
                'lane_count' => $laneCount,
                'default_bid_increment' => [100, 500, 1000][rand(0, 2)],
                'countdown_seconds' => 3,
                'deposit_required' => rand(0, 1) === 1,
                'upload_deadline' => Carbon::parse($eventDate)->subDays(1),
                'payment_deadline_hours' => 24,
                'shipping_deadline_hours' => 48,
                'created_by' => $admin->id,
            ]);

            // レーン作成
            for ($j = 1; $j <= $laneCount; $j++) {
                Lane::create([
                    'auction_id' => $auction->id,
                    'lane_number' => $j,
                    'status' => $status === 'finished' ? 'finished' : 'waiting',
                ]);
            }

            $auctions[] = $auction;

            if ($i % 5 === 0) {
                $this->command->info("  オークション作成中: {$i}/{$this->auctionCount}");
            }
        }

        $this->command->info('✓ オークション作成完了: ' . count($auctions) . '件');
        return $auctions;
    }

    /**
     * 生体（アイテム）作成
     */
    private function seedItems(array $auctions, array $sellers): void
    {
        $speciesData = [
            ['name' => 'ボールパイソン アルビノ', 'price' => 30000],
            ['name' => 'ボールパイソン パイボールド', 'price' => 50000],
            ['name' => 'ボールパイソン スパイダー', 'price' => 35000],
            ['name' => 'ボールパイソン バナナ', 'price' => 45000],
            ['name' => 'ボールパイソン クラウン', 'price' => 80000],
            ['name' => 'レオパードゲッコー タンジェリン', 'price' => 15000],
            ['name' => 'レオパードゲッコー ブレイジングブリザード', 'price' => 25000],
            ['name' => 'レオパードゲッコー スーパーマックスノー', 'price' => 30000],
            ['name' => 'レオパードゲッコー ラプター', 'price' => 20000],
            ['name' => 'コーンスネーク アメラニスティック', 'price' => 12000],
            ['name' => 'コーンスネーク スノー', 'price' => 18000],
            ['name' => 'コーンスネーク ブラッドレッド', 'price' => 15000],
            ['name' => 'フトアゴヒゲトカゲ レッド', 'price' => 25000],
            ['name' => 'フトアゴヒゲトカゲ ハイポ', 'price' => 30000],
            ['name' => 'フトアゴヒゲトカゲ ゼロ', 'price' => 50000],
            ['name' => 'クレステッドゲッコー ファイア', 'price' => 20000],
            ['name' => 'クレステッドゲッコー ハーレクイン', 'price' => 35000],
            ['name' => 'ニシアフリカトカゲモドキ ホワイトアウト', 'price' => 25000],
            ['name' => 'カーペットパイソン ジャガー', 'price' => 60000],
            ['name' => 'グリーンパイソン', 'price' => 80000],
        ];

        $notes = [
            '状態良好です。餌食い抜群。初心者の方にもおすすめです。',
            '色彩鮮やかな個体です。',
            'CBH個体。親も当店で管理しています。',
            '冷凍マウス切り替え済み。',
            '人工餌に餌付け済みです。',
            'とても人懐っこい性格です。',
            'ブリード実績のある個体です。',
            '発色が良く、将来有望です。',
            'ペアリング可能な個体です。',
            '美個体です。おすすめ！',
        ];

        $totalItems = 0;
        $sellerCount = count($sellers);
        $speciesCount = count($speciesData);
        $now = now();

        foreach ($auctions as $auctionIndex => $auction) {
            $itemCount = $this->itemsPerAuction;
            $itemsToInsert = [];
            
            for ($i = 1; $i <= $itemCount; $i++) {
                $sellerIndex = ($i - 1) % $sellerCount;
                $speciesIndex = rand(0, $speciesCount - 1);
                $species = $speciesData[$speciesIndex];

                // ステータス決定
                $status = 'registered';
                if ($auction->status === 'finished') {
                    $status = rand(0, 10) <= 7 ? 'sold' : 'unsold';
                } elseif ($auction->status === 'scheduled' || $auction->status === 'preparing') {
                    $status = rand(0, 10) <= 2 ? 'draft' : 'registered';
                }

                $sex = ['オス', 'メス', '不明'][rand(0, 2)];
                $age = rand(1, 36);
                $size = rand(10, 120);
                $weight = rand(30, 1500);

                $itemsToInsert[] = [
                    'auction_id' => $auction->id,
                    'seller_profile_id' => $sellers[$sellerIndex]['profile']->id,
                    'item_number' => $i,
                    'species_name' => $species['name'],
                    'quantity' => rand(1, 3),
                    'start_price' => $species['price'],
                    'current_price' => $species['price'],
                    'reserve_price' => (int)($species['price'] * 0.8),
                    'estimated_price' => (int)($species['price'] * 1.5),
                    'bid_increment' => [100, 500, 1000][rand(0, 2)],
                    'inspection_info' => "健康状態：良好\n餌食い：良好\n最終給餌日：" . $now->copy()->subDays(rand(1, 7))->format('Y年m月d日') . "\n特記事項：特になし",
                    'individual_info' => "性別：{$sex}\n月齢：約{$age}ヶ月\n体長：約{$size}cm\n体重：約{$weight}g\n産地：CB（国内繁殖）",
                    'notes' => $notes[array_rand($notes)],
                    'is_premium' => rand(0, 9) === 0,
                    'premium_fee' => 800,
                    'status' => $status,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                // 500件ごとにバルクインサート
                if (count($itemsToInsert) >= 500) {
                    DB::table('items')->insert($itemsToInsert);
                    $totalItems += count($itemsToInsert);
                    $itemsToInsert = [];
                }
            }

            // 残りを挿入
            if (count($itemsToInsert) > 0) {
                DB::table('items')->insert($itemsToInsert);
                $totalItems += count($itemsToInsert);
            }

            $this->command->info("  アイテム作成中: オークション " . ($auctionIndex + 1) . "/{$this->auctionCount} 完了 (累計: {$totalItems}件)");
        }

        $this->command->info('✓ 生体（アイテム）作成完了: ' . $totalItems . '件');
    }

    /**
     * 落札データ作成
     */
    private function seedWonItems(array $participants): void
    {
        $soldItems = Item::where('status', 'sold')->get();
        $wonCount = 0;
        $participantCount = count($participants);
        $now = now();

        $prefectures = ['北海道', '東京都', '神奈川県', '大阪府', '愛知県', '福岡県', '広島県', '宮城県'];
        $shippingCompanies = ['ヤマト運輸', '佐川急便', '日本郵便', '西濃運輸'];

        $wonItemsToInsert = [];
        $itemUpdates = [];

        $this->command->info("  落札データ作成中: 対象 {$soldItems->count()} 件");

        foreach ($soldItems as $index => $item) {
            $participant = $participants[rand(0, $participantCount - 1)];
            $winningPrice = $item->start_price + (rand(1, 20) * $item->bid_increment);
            $commissionRate = 5;
            $commissionAmount = max(300, (int)($winningPrice * $commissionRate / 100));

            // ランダムで支払い状態を決定
            $paymentStatuses = ['pending', 'paid', 'confirmed'];
            $paymentStatus = $paymentStatuses[array_rand($paymentStatuses)];

            // delivery_status: 'pending', 'preparing', 'shipped', 'completed', 'cancelled'
            $deliveryStatus = 'pending';
            if ($paymentStatus === 'confirmed') {
                $deliveryStatuses = ['preparing', 'shipped', 'completed'];
                $deliveryStatus = $deliveryStatuses[array_rand($deliveryStatuses)];
            }

            $prefecture = $prefectures[array_rand($prefectures)];

            $wonItemsToInsert[] = [
                'item_id' => $item->id,
                'winner_id' => $participant->id,
                'winning_price' => $winningPrice,
                'quantity' => $item->quantity,
                'total_amount' => $winningPrice + $commissionAmount + 800,
                'commission_rate' => $commissionRate,
                'commission_amount' => $commissionAmount,
                'seller_amount' => $winningPrice - (int)($winningPrice * 10 / 100),
                'payment_status' => $paymentStatus,
                'payment_method' => $paymentStatus !== 'pending' ? 'bank_transfer' : null,
                'paid_at' => $paymentStatus !== 'pending' ? $now->copy()->subDays(rand(1, 5)) : null,
                'payment_confirmed_at' => $paymentStatus === 'confirmed' ? $now->copy()->subDays(rand(1, 3)) : null,
                'payment_deadline' => $now->copy()->addDays(3),
                'delivery_method' => 'shipping',
                'delivery_status' => $deliveryStatus,
                'shipping_postal_code' => sprintf('%03d-%04d', rand(100, 999), rand(0, 9999)),
                'shipping_prefecture' => $prefecture,
                'shipping_city' => $prefecture === '東京都' ? ['千代田区', '中央区', '港区', '渋谷区'][rand(0, 3)] : '中央区',
                'shipping_address_line1' => rand(1, 10) . '-' . rand(1, 30) . '-' . rand(1, 30),
                'shipping_name' => $participant->name,
                'shipping_phone' => sprintf('090-%04d-%04d', rand(1000, 9999), rand(1000, 9999)),
                'shipping_company' => in_array($deliveryStatus, ['shipped', 'completed']) ? $shippingCompanies[array_rand($shippingCompanies)] : null,
                'tracking_number' => in_array($deliveryStatus, ['shipped', 'completed']) ? sprintf('%04d-%04d-%04d', rand(1000, 9999), rand(1000, 9999), rand(1000, 9999)) : null,
                'shipped_at' => in_array($deliveryStatus, ['shipped', 'completed']) ? $now->copy()->subDays(rand(1, 2)) : null,
                'delivered_at' => $deliveryStatus === 'completed' ? $now->copy()->subDay() : null,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            $itemUpdates[] = ['id' => $item->id, 'current_price' => $winningPrice];

            // 500件ごとにバルクインサート
            if (count($wonItemsToInsert) >= 500) {
                DB::table('won_items')->insert($wonItemsToInsert);
                
                // アイテムの価格更新
                foreach ($itemUpdates as $update) {
                    DB::table('items')->where('id', $update['id'])->update(['current_price' => $update['current_price']]);
                }
                
                $wonCount += count($wonItemsToInsert);
                $this->command->info("    処理中: {$wonCount} 件完了");
                $wonItemsToInsert = [];
                $itemUpdates = [];
            }
        }

        // 残りを挿入
        if (count($wonItemsToInsert) > 0) {
            DB::table('won_items')->insert($wonItemsToInsert);
            foreach ($itemUpdates as $update) {
                DB::table('items')->where('id', $update['id'])->update(['current_price' => $update['current_price']]);
            }
            $wonCount += count($wonItemsToInsert);
        }

        $this->command->info('✓ 落札データ作成完了: ' . $wonCount . '件');
    }
}
