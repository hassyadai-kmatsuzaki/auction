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
    /**
     * デモデータを作成
     */
    public function run(): void
    {
        $this->command->info('デモデータの作成を開始します...');

        // 既存データをクリア（外部キー制約を一時的に無効化）
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        
        WonItem::truncate();
        DB::table('lane_items')->truncate();
        Item::truncate();
        Lane::truncate();
        Auction::truncate();
        Announcement::truncate();
        SellerProfile::truncate();
        DB::table('user_roles')->truncate();
        User::where('email', '!=', 'admin@example.com')->delete();
        
        DB::statement('SET FOREIGN_KEY_CHECKS=1');

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

        $sellerData = [
            [
                'name' => '山田養殖場',
                'email' => 'seller1@example.com',
                'seller_name' => '山田養殖場',
                'contact_name' => '山田太郎',
                'phone' => '03-1234-5678',
                'seller_code' => 'S001',
            ],
            [
                'name' => '佐藤ブリーダー',
                'email' => 'seller2@example.com',
                'seller_name' => '佐藤ブリーダー',
                'contact_name' => '佐藤花子',
                'phone' => '06-2345-6789',
                'seller_code' => 'S002',
            ],
            [
                'name' => '鈴木水産',
                'email' => 'seller3@example.com',
                'seller_name' => '鈴木水産',
                'contact_name' => '鈴木一郎',
                'phone' => '052-3456-7890',
                'seller_code' => 'S003',
            ],
        ];

        foreach ($sellerData as $data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]);

            if ($sellerRole) {
                $user->roles()->attach($sellerRole->id);
            }

            $profile = SellerProfile::create([
                'user_id' => $user->id,
                'seller_code' => $data['seller_code'],
                'seller_name' => $data['seller_name'],
                'contact_name' => $data['contact_name'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'postal_code' => '123-4567',
                'prefecture' => '東京都',
                'city' => '渋谷区',
                'address_line1' => '渋谷1-2-3',
                'bank_name' => 'みずほ銀行',
                'bank_branch' => '渋谷支店',
                'account_type' => 'savings',
                'account_number' => '1234567',
                'account_holder' => $data['contact_name'],
                'is_active' => true,
            ]);

            $sellers[] = ['user' => $user, 'profile' => $profile];
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

        $participantData = [
            ['name' => '田中健一', 'email' => 'participant1@example.com'],
            ['name' => '高橋美咲', 'email' => 'participant2@example.com'],
            ['name' => '伊藤大輔', 'email' => 'participant3@example.com'],
            ['name' => '渡辺由美', 'email' => 'participant4@example.com'],
            ['name' => '中村翔太', 'email' => 'participant5@example.com'],
        ];

        foreach ($participantData as $data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]);

            if ($participantRole) {
                $user->roles()->attach($participantRole->id);
            }

            $participants[] = $user;
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

        $auctionData = [
            [
                'title' => '第1回 爬虫類オークション',
                'event_date' => now()->addDays(7)->format('Y-m-d'),
                'start_time' => '10:00:00',
                'status' => 'scheduled',
                'description' => '記念すべき第1回オークションです。',
                'lane_count' => 3,
            ],
            [
                'title' => '第2回 希少種特別オークション',
                'event_date' => now()->addDays(14)->format('Y-m-d'),
                'start_time' => '13:00:00',
                'status' => 'scheduled',
                'description' => '希少種を中心とした特別オークションです。',
                'lane_count' => 2,
            ],
            [
                'title' => '週末定期オークション',
                'event_date' => now()->subDays(7)->format('Y-m-d'),
                'start_time' => '14:00:00',
                'status' => 'finished',
                'description' => '毎週開催の定期オークションです。',
                'lane_count' => 4,
            ],
        ];

        foreach ($auctionData as $data) {
            $auction = Auction::create([
                'title' => $data['title'],
                'event_date' => $data['event_date'],
                'start_time' => $data['start_time'],
                'status' => $data['status'],
                'description' => $data['description'],
                'lane_count' => $data['lane_count'],
                'default_bid_increment' => 100,
                'countdown_seconds' => 3,
                'deposit_required' => false,
                'upload_deadline' => Carbon::parse($data['event_date'])->subDays(1),
                'payment_deadline_hours' => 24,
                'shipping_deadline_hours' => 48,
                'created_by' => $admin->id,
            ]);

            // レーン作成
            for ($i = 1; $i <= $data['lane_count']; $i++) {
                Lane::create([
                    'auction_id' => $auction->id,
                    'lane_number' => $i,
                    'status' => 'waiting',
                ]);
            }

            $auctions[] = $auction;
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
            ['name' => 'レオパードゲッコー タンジェリン', 'price' => 15000],
            ['name' => 'レオパードゲッコー ブレイジングブリザード', 'price' => 25000],
            ['name' => 'コーンスネーク アメラニスティック', 'price' => 12000],
            ['name' => 'フトアゴヒゲトカゲ レッド', 'price' => 25000],
        ];

        $totalItems = 0;

        foreach ($auctions as $auction) {
            $itemCount = rand(4, 6);
            
            for ($i = 1; $i <= $itemCount; $i++) {
                $sellerIndex = ($i - 1) % count($sellers);
                $speciesIndex = ($i - 1) % count($speciesData);
                $species = $speciesData[$speciesIndex];

                // ステータス決定
                $status = 'registered';
                if ($auction->status === 'finished') {
                    $status = rand(0, 1) ? 'sold' : 'unsold';
                } elseif ($auction->status === 'scheduled') {
                    $status = rand(0, 3) === 0 ? 'draft' : 'registered';
                }

                Item::create([
                    'auction_id' => $auction->id,
                    'seller_profile_id' => $sellers[$sellerIndex]['profile']->id,
                    'item_number' => $i,
                    'species_name' => $species['name'],
                    'quantity' => rand(1, 2),
                    'start_price' => $species['price'],
                    'current_price' => $species['price'],
                    'reserve_price' => $species['price'] * 0.8,
                    'estimated_price' => $species['price'] * 1.5,
                    'bid_increment' => 100,
                    'inspection_info' => json_encode([
                        'health_status' => 'good',
                        'feeding_status' => 'active',
                    ]),
                    'individual_info' => json_encode([
                        'sex' => ['male', 'female', 'unknown'][rand(0, 2)],
                        'age' => rand(1, 24) . 'ヶ月',
                    ]),
                    'notes' => '状態良好です。',
                    'is_premium' => rand(0, 4) === 0,
                    'premium_fee' => 800,
                    'status' => $status,
                ]);

                $totalItems++;
            }
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

        foreach ($soldItems as $item) {
            $participant = $participants[array_rand($participants)];
            $winningPrice = $item->start_price + (rand(1, 5) * 100);
            $commissionRate = 5;
            $commissionAmount = max(300, $winningPrice * $commissionRate / 100);

            // ランダムで支払い状態を決定
            $paymentStatuses = ['pending', 'paid', 'confirmed'];
            $paymentStatus = $paymentStatuses[array_rand($paymentStatuses)];

            // delivery_status: 'pending', 'preparing', 'shipped', 'completed', 'cancelled'
            $deliveryStatus = 'pending';
            if ($paymentStatus === 'confirmed') {
                $deliveryStatuses = ['preparing', 'shipped', 'completed'];
                $deliveryStatus = $deliveryStatuses[array_rand($deliveryStatuses)];
            }

            WonItem::create([
                'item_id' => $item->id,
                'winner_id' => $participant->id,
                'winning_price' => $winningPrice,
                'quantity' => $item->quantity,
                'total_amount' => $winningPrice + $commissionAmount + 800,
                'commission_rate' => $commissionRate,
                'commission_amount' => $commissionAmount,
                'seller_amount' => $winningPrice - ($winningPrice * 10 / 100),
                'payment_status' => $paymentStatus,
                'payment_method' => $paymentStatus !== 'pending' ? 'bank_transfer' : null,
                'paid_at' => $paymentStatus !== 'pending' ? now()->subDays(rand(1, 5)) : null,
                'payment_confirmed_at' => $paymentStatus === 'confirmed' ? now()->subDays(rand(1, 3)) : null,
                'payment_deadline' => now()->addDays(3),
                'delivery_method' => 'shipping',
                'delivery_status' => $deliveryStatus,
                'shipping_postal_code' => '100-0001',
                'shipping_prefecture' => '東京都',
                'shipping_city' => '千代田区',
                'shipping_address_line1' => '丸の内1-1-1',
                'shipping_name' => $participant->name,
                'shipping_phone' => '090-1234-5678',
                'shipping_company' => in_array($deliveryStatus, ['shipped', 'completed']) ? 'ヤマト運輸' : null,
                'tracking_number' => in_array($deliveryStatus, ['shipped', 'completed']) ? '1234-5678-9012' : null,
                'shipped_at' => in_array($deliveryStatus, ['shipped', 'completed']) ? now()->subDays(rand(1, 2)) : null,
                'delivered_at' => $deliveryStatus === 'completed' ? now()->subDay() : null,
            ]);

            // アイテムの現在価格を更新
            $item->update(['current_price' => $winningPrice]);

            $wonCount++;
        }

        $this->command->info('✓ 落札データ作成完了: ' . $wonCount . '件');
    }
}
