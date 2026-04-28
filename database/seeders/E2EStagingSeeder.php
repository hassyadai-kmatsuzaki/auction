<?php

namespace Database\Seeders;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\Plan;
use App\Models\Role;
use App\Models\SellerProfile;
use App\Models\SpeciesType;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WonItem;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * E2E (staging) 環境用シーダー。テスト仕様書 §10.4.2 に基づく最小データセットを構築する。
 *
 *  - Admin / Seller A,B / Participant X,Y,Z の固定アカウント
 *  - Auction #PAST-1 / #PAST-2 / #PAST-3 (event_date が過去で finished)
 *  - 各 Auction には Lane と Item を複数件
 *  - WonItem は Participant の状況 (X=入金前 / Y=入金済発送前 / Z=配達完了) に合わせて生成
 *  - ShippingRate / PackingMaterial / SpeciesType 等のマスタは存在確認のみ
 *  - 全 User に active subscription を付与
 *
 * 冪等性: email / title / 名称をキーに updateOrCreate / firstOrCreate を多用し、
 *         関連レコードは「親レコードに対して deleteAll → 再生成」する方式で固定状態に揃える。
 *
 * 実行: php artisan db:seed --class=E2EStagingSeeder
 *
 * 本番実行不可: app()->environment() が production の場合、冒頭で abort する。
 */
class E2EStagingSeeder extends Seeder
{
    private const TITLE_PREFIX = '[E2E-STAGING]';

    private const DEFAULT_PASSWORD = 'password';

    private const ADMIN_EMAIL = 'e2e-admin@auction.test';
    private const SELLER_A_EMAIL = 'e2e-seller-a@auction.test';
    private const SELLER_B_EMAIL = 'e2e-seller-b@auction.test';
    private const PARTICIPANT_X_EMAIL = 'e2e-participant-x@auction.test';
    private const PARTICIPANT_Y_EMAIL = 'e2e-participant-y@auction.test';
    private const PARTICIPANT_Z_EMAIL = 'e2e-participant-z@auction.test';

    private const PLAN_CODE = 'e2e_staging_full';

    public function run(): void
    {
        // 本番への流入を完全に遮断する。env('APP_ENV') ではなく Laravel の判定を使う。
        if (app()->environment('production')) {
            throw new \RuntimeException('E2EStagingSeeder cannot run in production');
        }

        $this->ensureMasterData();

        DB::transaction(function () {
            $admin = $this->seedAdmin();
            $sellerA = $this->seedSeller(self::SELLER_A_EMAIL, 'E2E 出品者A', 'E2E-S-A');
            $sellerB = $this->seedSeller(self::SELLER_B_EMAIL, 'E2E 出品者B', 'E2E-S-B');
            $sellerProfileA = $this->ensureSellerProfile($sellerA, 'E2E-A001', 'E2E 出品者A 商店');
            $sellerProfileB = $this->ensureSellerProfile($sellerB, 'E2E-B001', 'E2E 出品者B 商店');

            $participantX = $this->seedParticipant(self::PARTICIPANT_X_EMAIL, 'E2E 参加者X');
            $participantY = $this->seedParticipant(self::PARTICIPANT_Y_EMAIL, 'E2E 参加者Y');
            $participantZ = $this->seedParticipant(self::PARTICIPANT_Z_EMAIL, 'E2E 参加者Z');

            $plan = $this->ensurePlan();
            foreach ([$admin, $sellerA, $sellerB, $participantX, $participantY, $participantZ] as $user) {
                $this->ensureActiveSubscription($user, $plan);
            }

            // 既存の E2E オークション一式を破棄してから再生成（冪等性確保）
            $this->cleanupExistingAuctions();

            // PAST-1: 3 日前終了。WonItem あり (Seller A / B 双方の出品)
            $past1 = $this->createAuction($admin, 'PAST-1', now()->subDays(3), '3日前 終了済み');
            $past1Items = [
                $this->createItem($past1, $sellerProfileA, 1, '紅白ラメ', 2, 5000, 'sold'),
                $this->createItem($past1, $sellerProfileA, 2, '幹之フルボディ', 1, 3000, 'sold'),
                $this->createItem($past1, $sellerProfileB, 3, '楊貴妃ダルマ', 1, 2500, 'sold'),
                $this->createItem($past1, $sellerProfileB, 4, '三色ラメ', 3, 4000, 'sold'),
            ];
            $this->buildLanes($past1, [
                [$past1Items[0], $past1Items[1]],
                [$past1Items[2], $past1Items[3]],
            ]);

            // Participant X: 落札あり・入金前 (PAST-1 の Item #1)
            $this->createWonItem($past1Items[0], $participantX, 8500, [
                'payment_status' => 'pending',
                'delivery_status' => 'pending',
                'payment_deadline' => now()->addDay(),
                'shipping_fee' => 1200,
            ]);

            // Participant Y: 入金済み発送前 (PAST-1 の Item #2)
            $this->createWonItem($past1Items[1], $participantY, 4500, [
                'payment_status' => 'confirmed',
                'payment_method' => 'bank_transfer',
                'paid_at' => now()->subDays(2),
                'payment_confirmed_at' => now()->subDay(),
                'payment_deadline' => now()->subDay(),
                'delivery_status' => 'preparing',
                'shipping_fee' => 1200,
            ]);

            // Participant Z: 配達完了 (PAST-1 の Item #3)
            $this->createWonItem($past1Items[2], $participantZ, 3200, [
                'payment_status' => 'confirmed',
                'payment_method' => 'bank_transfer',
                'paid_at' => now()->subDays(3),
                'payment_confirmed_at' => now()->subDays(2),
                'payment_deadline' => now()->subDays(2),
                'delivery_status' => 'completed',
                'shipping_company' => 'ヤマト運輸',
                'tracking_number' => 'E2E-1234-5678',
                'shipped_at' => now()->subDays(2),
                'delivered_at' => now()->subDay(),
                'shipping_fee' => 1200,
            ]);

            // PAST-1 Item #4 は流通あり: Z が追加で落札済み・配達完了
            $this->createWonItem($past1Items[3], $participantZ, 6000, [
                'payment_status' => 'confirmed',
                'payment_method' => 'bank_transfer',
                'paid_at' => now()->subDays(3),
                'payment_confirmed_at' => now()->subDays(2),
                'payment_deadline' => now()->subDays(2),
                'delivery_status' => 'completed',
                'shipping_company' => '佐川急便',
                'tracking_number' => 'E2E-9876-5432',
                'shipped_at' => now()->subDays(2),
                'delivered_at' => now()->subDay(),
                'shipping_fee' => 1500,
            ]);

            // PAST-2: 1 日前終了 / 配送料計算前
            $past2 = $this->createAuction($admin, 'PAST-2', now()->subDay(), '1日前 終了済み 送料未計算');
            $past2Items = [
                $this->createItem($past2, $sellerProfileA, 1, '夜桜ゴールド', 2, 3500, 'sold'),
                $this->createItem($past2, $sellerProfileA, 2, 'オロチ', 1, 8000, 'unsold'),
            ];
            $this->buildLanes($past2, [[$past2Items[0], $past2Items[1]]]);
            $this->createWonItem($past2Items[0], $participantX, 5500, [
                'payment_status' => 'pending',
                'delivery_status' => 'pending',
                'payment_deadline' => now()->addDay(),
                'shipping_fee' => 0,
                'shipping_calculated_at' => null,
            ]);

            // PAST-3: 12 時間前終了 / 入金期限を 2 時間後に設定 (催促対象)
            $past3 = $this->createAuction($admin, 'PAST-3', now()->subHours(12), '12時間前 終了 催促対象');
            $past3Items = [
                $this->createItem($past3, $sellerProfileB, 1, '01 メダカ', 5, 1000, 'sold'),
                $this->createItem($past3, $sellerProfileB, 2, '02 メダカ', 3, 1500, 'sold'),
            ];
            $this->buildLanes($past3, [[$past3Items[0], $past3Items[1]]]);
            $this->createWonItem($past3Items[0], $participantX, 1800, [
                'payment_status' => 'pending',
                'delivery_status' => 'pending',
                'payment_deadline' => now()->addHours(2),
                'shipping_fee' => 800,
            ]);
            $this->createWonItem($past3Items[1], $participantX, 2200, [
                'payment_status' => 'pending',
                'delivery_status' => 'pending',
                'payment_deadline' => now()->addHours(2),
                'shipping_fee' => 800,
            ]);
        });

        $this->report();
    }

    /* ---------------- マスタ確認 ---------------- */

    private function ensureMasterData(): void
    {
        // Role: マイグレーション or RoleSeeder で投入済み想定 → 不足分のみ補完
        foreach ([
            ['admin', '管理者', 'システム管理者'],
            ['seller', '出品者', '商品を出品できるユーザー'],
            ['participant', '参加者', '入札に参加できるユーザー'],
        ] as [$name, $display, $desc]) {
            Role::firstOrCreate(
                ['name' => $name],
                ['display_name' => $display, 'description' => $desc]
            );
        }

        // SpeciesType (medaka): マイグレーションで投入済み想定 → 万一なければ追加
        SpeciesType::firstOrCreate(
            ['code' => 'medaka'],
            [
                'name' => 'メダカ',
                'calculation_mode' => 'auto',
                'is_mixable' => false,
                'is_default' => true,
                'allowed_quantity_units' => ['fish'],
                'sort_order' => 1,
                'is_active' => true,
            ]
        );

        // ShippingRate / PackingMaterial はマイグレーション投入済み（2026_04_01_000001）。
        // staging で何らかの事情で消えていた場合のみ警告のみ出して継続する（送料計算は固定値で書き込むため）。
        if (DB::table('shipping_rates')->count() === 0) {
            $this->command->warn('shipping_rates テーブルが空です。マイグレーション 2026_04_01_000001 を再投入してください。');
        }
        if (DB::table('packing_materials')->count() === 0) {
            $this->command->warn('packing_materials テーブルが空です。マイグレーション 2026_04_01_000001 を再投入してください。');
        }
    }

    /* ---------------- ユーザー / ロール ---------------- */

    private function seedAdmin(): User
    {
        $admin = $this->upsertUser(self::ADMIN_EMAIL, 'E2E 管理者');
        $this->syncRoles($admin, ['admin', 'seller', 'participant']);
        return $admin;
    }

    private function seedSeller(string $email, string $name, string $codePrefix): User
    {
        $user = $this->upsertUser($email, $name);
        $this->syncRoles($user, ['seller', 'participant']);
        return $user;
    }

    private function seedParticipant(string $email, string $name): User
    {
        $user = $this->upsertUser($email, $name);
        $this->syncRoles($user, ['participant']);
        return $user;
    }

    private function upsertUser(string $email, string $name): User
    {
        // users テーブルには deleted_at カラムがあるが User モデルは SoftDeletes を使っていない。
        // 通常クエリで where('deleted_at', null) フィルタは行わないため、updateOrCreate で十分。
        // 万一 deleted_at が立っていたら raw update で解除しておく。
        DB::table('users')->where('email', $email)->whereNotNull('deleted_at')->update(['deleted_at' => null]);

        $attrs = [
            'name' => $name,
            'password' => Hash::make(self::DEFAULT_PASSWORD),
            'status' => 'approved',
            'approved_at' => now(),
            'is_active' => true,
            'email_verified_at' => now(),
            'phone' => '03-0000-0000',
            'postal_code' => '100-0001',
            'prefecture' => '東京',
            'city' => '千代田区',
            'address_line1' => '千代田1-1-1',
            'address_line2' => 'E2Eビル101',
        ];
        return User::updateOrCreate(['email' => $email], $attrs);
    }

    private function syncRoles(User $user, array $roleNames): void
    {
        $roleIds = Role::whereIn('name', $roleNames)->pluck('id')->all();
        $payload = [];
        foreach ($roleIds as $id) {
            $payload[$id] = ['assigned_at' => now()];
        }
        // sync すれば既存リレーションが正規化される
        $user->roles()->sync($payload);
    }

    private function ensureSellerProfile(User $user, string $sellerCode, string $sellerName): SellerProfile
    {
        return SellerProfile::updateOrCreate(
            ['user_id' => $user->id],
            [
                'seller_code' => $sellerCode,
                'seller_name' => $sellerName,
                'contact_name' => $user->name,
                'email' => $user->email,
                'phone' => '03-0000-0000',
                'postal_code' => '100-0001',
                'prefecture' => '東京',
                'city' => '千代田区',
                'address_line1' => '千代田1-1-1',
                'bank_name' => 'みずほ銀行',
                'bank_branch' => '東京支店',
                'account_type' => 'savings',
                'account_number' => '1234567',
                'account_holder' => 'カ）E2Eテスト',
                'commission_rate' => 10,
                'is_active' => true,
            ]
        );
    }

    /* ---------------- Plan / Subscription ---------------- */

    private function ensurePlan(): Plan
    {
        return Plan::updateOrCreate(
            ['code' => self::PLAN_CODE],
            [
                'name' => 'E2E Staging Full',
                'description' => 'E2E staging 用の入札・出品双方を許可するプラン',
                'amount' => 0,
                'allows_bid' => true,
                'allows_sell' => true,
                'is_active' => true,
                'sort_order' => 9999,
            ]
        );
    }

    private function ensureActiveSubscription(User $user, Plan $plan): Subscription
    {
        return Subscription::updateOrCreate(
            ['user_id' => $user->id],
            [
                'plan_id' => $plan->id,
                'status' => Subscription::STATUS_ACTIVE,
                'current_period_start' => now()->subMonth(),
                'current_period_end' => now()->addYear(),
                'canceled_at' => null,
                'suspended_at' => null,
                'suspended_reason' => null,
            ]
        );
    }

    /* ---------------- Auction / Lane / Item ---------------- */

    private function cleanupExistingAuctions(): void
    {
        // Auction は SoftDeletes を使うので withTrashed で取り、forceDelete で確実に削除。
        $auctionIds = Auction::withTrashed()->where('title', 'like', self::TITLE_PREFIX . '%')->pluck('id');
        if ($auctionIds->isEmpty()) {
            return;
        }
        $itemIds = Item::whereIn('auction_id', $auctionIds)->pluck('id');
        WonItem::whereIn('item_id', $itemIds)->delete();
        DB::table('lane_items')->whereIn('item_id', $itemIds)->delete();
        DB::table('item_media')->whereIn('item_id', $itemIds)->delete();
        Item::whereIn('id', $itemIds)->delete();
        Lane::whereIn('auction_id', $auctionIds)->delete();
        DB::table('auction_seller_orders')->whereIn('auction_id', $auctionIds)->delete();
        Auction::withTrashed()->whereIn('id', $auctionIds)->forceDelete();
    }

    private function createAuction(User $admin, string $label, Carbon $eventDate, string $subtitle): Auction
    {
        $title = sprintf('%s #%s %s', self::TITLE_PREFIX, $label, $subtitle);
        return Auction::create([
            'title' => $title,
            'event_date' => $eventDate->toDateString(),
            'start_time' => $eventDate->format('H:i:s'),
            'end_time' => $eventDate->copy()->addHour()->format('H:i:s'),
            'status' => 'finished',
            'description' => 'E2E staging 環境の動作検証用オークションです。',
            'lane_count' => 2,
            'default_bid_increment' => 100,
            'countdown_seconds' => 3,
            'deposit_required' => false,
            'upload_deadline' => $eventDate->copy()->subDay(),
            'payment_deadline_hours' => 24,
            'shipping_deadline_hours' => 48,
            'created_by' => $admin->id,
        ]);
    }

    /**
     * Lane を作成し、引数の Item 配列を順に lane_items に紐付ける。
     */
    private function buildLanes(Auction $auction, array $itemsByLane): void
    {
        foreach ($itemsByLane as $laneIndex => $items) {
            $lane = Lane::create([
                'auction_id' => $auction->id,
                'lane_number' => $laneIndex + 1,
                'status' => 'finished',
                'started_at' => now()->subDays(3),
                'finished_at' => now()->subDays(3)->addHour(),
            ]);
            foreach ($items as $sequence => $item) {
                DB::table('lane_items')->insert([
                    'lane_id' => $lane->id,
                    'item_id' => $item->id,
                    'sequence_order' => $sequence + 1,
                    'started_at' => now()->subDays(3),
                    'finished_at' => now()->subDays(3)->addMinutes(5),
                    'duration_seconds' => 300,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    private function createItem(
        Auction $auction,
        SellerProfile $sellerProfile,
        int $itemNumber,
        string $species,
        int $quantity,
        int $startPrice,
        string $status
    ): Item {
        $speciesType = SpeciesType::where('code', 'medaka')->firstOrFail();
        return Item::create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
            'item_number' => $itemNumber,
            'seller_display_order' => $itemNumber,
            'species_name' => $species,
            'species_type_id' => $speciesType->id,
            'quantity' => $quantity,
            'quantity_unit' => 'fish',
            'start_price' => $startPrice,
            'current_price' => $startPrice,
            'reserve_price' => (int) ($startPrice * 0.8),
            'estimated_price' => (int) ($startPrice * 1.5),
            'bid_increment' => 100,
            'inspection_info' => "健康状態：良好\n餌食い：良好",
            'individual_info' => "性別：不明\n月齢：約3ヶ月",
            'notes' => 'E2E staging 用ダミーデータ',
            'is_premium' => false,
            'premium_fee' => 0,
            'status' => $status,
        ]);
    }

    /* ---------------- WonItem ---------------- */

    private function createWonItem(Item $item, User $winner, int $winningPrice, array $overrides): WonItem
    {
        $commissionRate = 10;
        $totalBase = $winningPrice * $item->quantity;
        $commissionAmount = (int) round($totalBase * $commissionRate / 100);
        $shippingFee = $overrides['shipping_fee'] ?? 0;

        $base = [
            'item_id' => $item->id,
            'winner_id' => $winner->id,
            'winning_price' => $winningPrice,
            'quantity' => $item->quantity,
            'total_amount' => $totalBase + $commissionAmount + $shippingFee,
            'commission_rate' => $commissionRate,
            'commission_amount' => $commissionAmount,
            'seller_amount' => $totalBase - $commissionAmount,
            'shipping_fee' => $shippingFee,
            'shipping_breakdown' => null,
            'calculation_mode' => 'auto',
            'payment_status' => 'pending',
            'payment_method' => 'bank_transfer',
            'delivery_method' => 'shipping',
            'delivery_status' => 'pending',
            'payment_deadline' => now()->addDay(),
            'shipping_postal_code' => $winner->postal_code,
            'shipping_prefecture' => $winner->prefecture,
            'shipping_city' => $winner->city,
            'shipping_address_line1' => $winner->address_line1,
            'shipping_address_line2' => $winner->address_line2,
            'shipping_name' => $winner->name,
            'shipping_phone' => $winner->phone,
            'shipping_calculated_at' => $shippingFee > 0 ? now() : null,
        ];

        $payload = array_merge($base, $overrides);
        // total_amount の再計算（overrides で shipping_fee が変わった場合に整合させる）
        $payload['total_amount'] = ($winningPrice * $item->quantity)
            + $payload['commission_amount']
            + ($payload['shipping_fee'] ?? 0);

        $wonItem = new WonItem();
        $wonItem->forceFill($payload)->save();
        return $wonItem;
    }

    /* ---------------- 報告 ---------------- */

    private function report(): void
    {
        $this->command->info('✓ E2EStagingSeeder 完了');
        $this->command->info(sprintf(
            '  Users: admin=%s / sellers=%s,%s / participants=%s,%s,%s',
            self::ADMIN_EMAIL,
            self::SELLER_A_EMAIL,
            self::SELLER_B_EMAIL,
            self::PARTICIPANT_X_EMAIL,
            self::PARTICIPANT_Y_EMAIL,
            self::PARTICIPANT_Z_EMAIL
        ));
        $this->command->info('  password (全アカウント共通): ' . self::DEFAULT_PASSWORD);
        $auctions = Auction::where('title', 'like', self::TITLE_PREFIX . '%')->get();
        foreach ($auctions as $a) {
            $this->command->info(sprintf('  - %s (id=%d, event_date=%s)', $a->title, $a->id, $a->event_date));
        }
    }
}
