<?php

namespace Database\Seeders;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\Role;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use App\Services\ShippingCalculatorService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * 配送料金算出ロジックの代表的なパターンを管理画面で確認するためのデータを投入する。
 *
 * 袋規定: 1-30匹=S / 31-200匹=M / 201-500匹=L / 501+匹=KA
 * 箱容量: 80(S×1) / 100(S×2 or M×1) / 140(S×9, M×3, L×2, KA×1)
 *
 * 網羅するパターン（(auction × winner) グループ単位で 1 パターン）:
 *   - 小ロット単発(10匹)                 → 80 箱
 *   - M単独(100匹)                        → 100 箱
 *   - S×3 (30匹×3品)                      → 140 箱 (S×3)
 *   - S+M 混載 (30匹 + 100匹)             → 140 箱
 *   - L 単発 (300匹)                      → 140 箱 (L×1)
 *   - KA 単発 (800匹)                     → 140 箱 (KA×1)
 *   - L×3 (300匹×3品) 複数箱             → 140 箱 ×複数
 *   - 6品の数量按分                       → 按分結果検証
 *
 * 落札者の内訳:
 *   - User(id=509)  : 配送料パターン用落札者A
 *   - User(id=516)  : 配送料パターン用落札者B（既存の大阪住所を尊重）
 *   - 残り 3 名     : id ≤ 400 の participant から選択（不足する場合のみ、id < 400 で新規作成）
 *   住所未設定のユーザーは住所を補完する（既存住所は尊重する）。
 *
 * (auction × winner) 内の payment_status / delivery_status は必ず統一する。
 *
 * 再実行安全: タイトル先頭 [SHIP-PATTERN] のレコードを削除してから投入する。
 */
class ShippingPatternsSeeder extends Seeder
{
    private const TITLE_PREFIX = '[SHIP-PATTERN]';

    /** 住所が未設定だった場合に補完する既定住所（落札者ID → 住所情報） */
    private const PRIMARY_WINNER_ADDRESSES = [
        509 => [
            'prefecture' => '北海道',
            'city' => '札幌市中央区北1条西2丁目',
            'address_line1' => '1-1',
            'address_line2' => null,
            'postal_code' => '060-0001',
            'phone' => '011-000-0509',
        ],
        516 => [
            'prefecture' => '大阪府',
            'city' => '大阪市中央区高麗橋1-5-8',
            'address_line1' => 'ディームス北浜1403号',
            'address_line2' => null,
            'postal_code' => '541-0043',
            'phone' => '06-0000-0516',
        ],
    ];

    /** 追加落札者に割り当てる地域（住所未設定時のみ適用） */
    private const ADDITIONAL_WINNER_ADDRESSES = [
        [
            'prefecture' => '東京都',
            'city' => '千代田区千代田',
            'address_line1' => '1-1',
            'address_line2' => null,
            'postal_code' => '100-0001',
            'phone' => '03-0000-0001',
        ],
        [
            'prefecture' => '沖縄県',
            'city' => '那覇市港町',
            'address_line1' => '1-1',
            'address_line2' => null,
            'postal_code' => '900-0001',
            'phone' => '098-000-0001',
        ],
        [
            'prefecture' => '福岡県',
            'city' => '福岡市博多区博多駅中央街',
            'address_line1' => '1-1',
            'address_line2' => null,
            'postal_code' => '812-0012',
            'phone' => '092-000-0001',
        ],
    ];

    public function run(): void
    {
        $admin = User::whereHas('roles', fn ($q) => $q->where('name', 'admin'))->orderBy('id')->first();
        if (!$admin) {
            $this->command->error('admin ユーザーが見つかりません。AdminUserSeeder を先に実行してください。');
            return;
        }

        $sellerProfiles = SellerProfile::orderBy('id')->limit(2)->get();
        if ($sellerProfiles->isEmpty()) {
            $this->command->error('seller_profile が必要です。DemoDataSeeder 等を先に実行してください。');
            return;
        }
        $sellerA = $sellerProfiles->first();
        $sellerB = $sellerProfiles->count() >= 2 ? $sellerProfiles->get(1) : $sellerA;

        $winners = $this->prepareWinners();
        if ($winners->count() < 5) {
            $this->command->error(sprintf('落札者が不足しています（必要5人, 実際%d人）', $winners->count()));
            return;
        }

        $shipping = app(ShippingCalculatorService::class);

        DB::transaction(function () use ($admin, $sellerA, $sellerB, $winners, $shipping) {
            $this->cleanupExisting();

            $small = $this->createAuction($admin, 'SMALL', now()->subDays(5), '小ロット & M単独');
            $mix   = $this->createAuction($admin, 'MIX',   now()->subDays(4), 'S複数 & S+M混載');
            $large = $this->createAuction($admin, 'LARGE', now()->subDays(3), 'L & KA & 複数箱');
            $app   = $this->createAuction($admin, 'APPORTION', now()->subDays(2), '6品按分');

            // --- Pattern 1: 小ロット単発 (10匹) → 80箱 ---
            $i1 = $this->createItem($small, $sellerA, 1, '紅白メダカ(小ロット)', 10, 4000, '/img/medaka/紅白ラメ.jpg');
            $this->persistGroup([$this->buildWonItem($i1, $winners[0], 8000)], $winners[0], $shipping, [
                'payment_status' => 'confirmed',
                'delivery_status' => 'completed',
                'paid_at' => now()->subDays(4),
                'payment_confirmed_at' => now()->subDays(4),
                'shipping_locked_at' => now()->subDays(4),
                'shipped_at' => now()->subDays(3),
                'delivered_at' => now()->subDays(2),
                'shipping_company' => 'ヤマト運輸',
                'tracking_number' => 'SP01-1000-0001',
            ]);

            // --- Pattern 2: M単独 (100匹) → 100箱 ---
            $i2 = $this->createItem($small, $sellerA, 2, '幹之フルボディ(M単独)', 100, 50000, '/img/medaka/幹之フルボディ.jpg');
            $this->persistGroup([$this->buildWonItem($i2, $winners[1], 80000)], $winners[1], $shipping, [
                'payment_status' => 'confirmed',
                'delivery_status' => 'shipped',
                'paid_at' => now()->subDays(4),
                'payment_confirmed_at' => now()->subDays(4),
                'shipping_locked_at' => now()->subDays(4),
                'shipped_at' => now()->subDays(2),
                'shipping_company' => 'ヤマト運輸',
                'tracking_number' => 'SP02-1000-0002',
            ]);

            // --- Pattern 3: S×3 (30匹×3品) → 140箱 (S×3) ---
            $i3a = $this->createItem($mix, $sellerA, 1, '楊貴妃S-1', 30, 12000, '/img/medaka/楊貴妃ダルマ.jpeg');
            $i3b = $this->createItem($mix, $sellerA, 2, '楊貴妃S-2', 30, 12500, '/img/medaka/楊貴妃ダルマ.jpeg');
            $i3c = $this->createItem($mix, $sellerA, 3, '楊貴妃S-3', 30, 11000, '/img/medaka/楊貴妃ダルマ.jpeg');
            $this->persistGroup([
                $this->buildWonItem($i3a, $winners[2], 15000),
                $this->buildWonItem($i3b, $winners[2], 14500),
                $this->buildWonItem($i3c, $winners[2], 13500),
            ], $winners[2], $shipping, [
                'payment_status' => 'confirmed',
                'delivery_status' => 'preparing',
                'paid_at' => now()->subDays(3),
                'payment_confirmed_at' => now()->subDays(3),
                'shipping_locked_at' => now()->subDays(3),
            ]);

            // --- Pattern 4: S+M 混載 (30匹 + 100匹) → 140箱 ---
            $i4a = $this->createItem($mix, $sellerB, 4, '三色ラメ(S)', 30, 18000, '/img/medaka/三色ラメ.jpeg');
            $i4b = $this->createItem($mix, $sellerB, 5, '夜桜ゴールド(M)', 100, 40000, '/img/medaka/夜桜ゴールド.jpg');
            $this->persistGroup([
                $this->buildWonItem($i4a, $winners[3], 22000),
                $this->buildWonItem($i4b, $winners[3], 55000),
            ], $winners[3], $shipping, [
                'payment_status' => 'paid',
                'delivery_status' => 'pending',
                'paid_at' => now()->subDays(1),
                'payment_deadline' => now()->addDay(),
            ]);

            // --- Pattern 5: L単発 (300匹) → 140箱 (L×1) ---
            $i5 = $this->createItem($large, $sellerA, 1, 'オロチ(L単発)', 300, 90000, '/img/medaka/オロチ.jpg');
            $this->persistGroup([$this->buildWonItem($i5, $winners[0], 120000)], $winners[0], $shipping, [
                'payment_status' => 'pending',
                'delivery_status' => 'pending',
                'payment_deadline' => now()->addDays(2),
            ]);

            // --- Pattern 6: KA単発 (800匹) → 140箱 (KA×1) ---
            $i6 = $this->createItem($large, $sellerA, 2, '出目(KA単発/大量)', 800, 150000, '/img/medaka/オロチ.jpg');
            $this->persistGroup([$this->buildWonItem($i6, $winners[4], 220000)], $winners[4], $shipping, [
                'payment_status' => 'confirmed',
                'delivery_status' => 'shipped',
                'paid_at' => now()->subDays(2),
                'payment_confirmed_at' => now()->subDays(2),
                'shipping_locked_at' => now()->subDays(2),
                'shipped_at' => now()->subDay(),
                'shipping_company' => '佐川急便',
                'tracking_number' => 'SP06-1000-0006',
            ]);

            // --- Pattern 7: L×3 (300匹×3品) → 140箱 ×複数 ---
            $i7a = $this->createItem($large, $sellerB, 3, '三色L-1', 300, 80000, '/img/medaka/三色ラメ.jpeg');
            $i7b = $this->createItem($large, $sellerB, 4, '三色L-2', 300, 82000, '/img/medaka/三色ラメ.jpeg');
            $i7c = $this->createItem($large, $sellerB, 5, '三色L-3', 300, 78000, '/img/medaka/三色ラメ.jpeg');
            $this->persistGroup([
                $this->buildWonItem($i7a, $winners[1], 100000),
                $this->buildWonItem($i7b, $winners[1], 105000),
                $this->buildWonItem($i7c, $winners[1], 98000),
            ], $winners[1], $shipping, [
                'payment_status' => 'confirmed',
                'delivery_status' => 'preparing',
                'paid_at' => now()->subDays(2),
                'payment_confirmed_at' => now()->subDays(2),
                'shipping_locked_at' => now()->subDays(2),
            ]);

            // --- Pattern 8: 6品 按分 ---
            $i8a = $this->createItem($app, $sellerB, 1, '按分T-1', 10, 3000, '/img/medaka/01.png');
            $i8b = $this->createItem($app, $sellerB, 2, '按分T-2', 15, 3500, '/img/medaka/02.png');
            $i8c = $this->createItem($app, $sellerB, 3, '按分T-3', 20, 4000, '/img/medaka/01.png');
            $i8d = $this->createItem($app, $sellerB, 4, '按分T-4', 25, 4500, '/img/medaka/02.png');
            $i8e = $this->createItem($app, $sellerB, 5, '按分T-5', 30, 5000, '/img/medaka/01.png');
            $i8f = $this->createItem($app, $sellerB, 6, '按分T-6', 20, 4800, '/img/medaka/02.png');
            $this->persistGroup([
                $this->buildWonItem($i8a, $winners[2], 4500),
                $this->buildWonItem($i8b, $winners[2], 5000),
                $this->buildWonItem($i8c, $winners[2], 6000),
                $this->buildWonItem($i8d, $winners[2], 7000),
                $this->buildWonItem($i8e, $winners[2], 8000),
                $this->buildWonItem($i8f, $winners[2], 7500),
            ], $winners[2], $shipping, [
                'payment_status' => 'pending',
                'delivery_status' => 'pending',
                'payment_deadline' => now()->addDay(),
            ]);
        });

        $this->report();
    }

    /**
     * 落札者5人を用意する。
     *   - id=509, 516 を優先
     *   - 残りは id ≤ 400 の participant から
     *   - いずれも住所が無ければ既定値で補完
     */
    private function prepareWinners(): \Illuminate\Support\Collection
    {
        $result = collect();

        foreach ([509, 516] as $id) {
            $user = User::find($id);
            if (!$user) {
                $this->command->warn(sprintf('User(id=%d) が存在しないためスキップします。', $id));
                continue;
            }
            $this->ensureParticipantRole($user);
            $this->ensureAddress($user, self::PRIMARY_WINNER_ADDRESSES[$id] ?? self::ADDITIONAL_WINNER_ADDRESSES[0]);
            $result->push($user->fresh());
        }

        $needed = 5 - $result->count();
        if ($needed > 0) {
            $candidates = User::where('id', '<=', 400)
                ->whereNotIn('id', $result->pluck('id'))
                ->whereHas('roles', fn ($q) => $q->where('name', 'participant'))
                ->orderBy('id')
                ->get();

            $index = 0;
            foreach ($candidates as $candidate) {
                if ($result->count() >= 5) break;
                $this->ensureAddress($candidate, self::ADDITIONAL_WINNER_ADDRESSES[$index % count(self::ADDITIONAL_WINNER_ADDRESSES)]);
                $result->push($candidate->fresh());
                $index++;
            }
        }

        return $result;
    }

    private function ensureParticipantRole(User $user): void
    {
        $role = Role::where('name', 'participant')->first();
        if ($role && !$user->roles()->where('role_id', $role->id)->exists()) {
            $user->roles()->attach($role->id);
        }
    }

    /**
     * 住所が欠けている場合だけ、既定値で上書きする。
     * 既に登録されている住所は尊重する。
     */
    private function ensureAddress(User $user, array $defaults): void
    {
        $fields = ['prefecture', 'city', 'address_line1', 'postal_code'];
        $needUpdate = false;
        foreach ($fields as $f) {
            if (blank($user->{$f})) {
                $needUpdate = true;
                break;
            }
        }
        if (!$needUpdate) {
            return;
        }

        $user->update([
            'postal_code'     => $user->postal_code     ?: $defaults['postal_code'],
            'prefecture'      => $user->prefecture      ?: $defaults['prefecture'],
            'city'            => $user->city            ?: $defaults['city'],
            'address_line1'   => $user->address_line1   ?: $defaults['address_line1'],
            'address_line2'   => $user->address_line2   ?: ($defaults['address_line2'] ?? null),
            'phone'           => $user->phone           ?: $defaults['phone'],
        ]);
    }

    private function cleanupExisting(): void
    {
        $auctionIds = Auction::where('title', 'like', self::TITLE_PREFIX . '%')->pluck('id');
        if ($auctionIds->isEmpty()) {
            return;
        }
        $itemIds = Item::whereIn('auction_id', $auctionIds)->pluck('id');
        WonItem::whereIn('item_id', $itemIds)->delete();
        DB::table('lane_items')->whereIn('item_id', $itemIds)->delete();
        DB::table('item_media')->whereIn('item_id', $itemIds)->delete();
        Item::whereIn('id', $itemIds)->delete();
        DB::table('lanes')->whereIn('auction_id', $auctionIds)->delete();
        DB::table('auction_seller_orders')->whereIn('auction_id', $auctionIds)->delete();
        Auction::whereIn('id', $auctionIds)->delete();
    }

    private function createAuction(User $admin, string $label, Carbon $eventDate, string $subtitle): Auction
    {
        $auction = Auction::create([
            'title' => sprintf('%s #%s %s', self::TITLE_PREFIX, $label, $subtitle),
            'event_date' => $eventDate->toDateString(),
            'start_time' => $eventDate->format('H:i:s'),
            'end_time' => $eventDate->copy()->addHour()->format('H:i:s'),
            'status' => 'finished',
            'description' => '配送料パターン検証用のオークションです。',
            'lane_count' => 1,
            'default_bid_increment' => 100,
            'countdown_seconds' => 3,
            'deposit_required' => false,
            'upload_deadline' => $eventDate->copy()->subDay(),
            'payment_deadline_hours' => 24,
            'shipping_deadline_hours' => 48,
            'created_by' => $admin->id,
        ]);

        Lane::create([
            'auction_id' => $auction->id,
            'lane_number' => 1,
            'status' => 'finished',
        ]);

        return $auction;
    }

    private function createItem(Auction $auction, SellerProfile $seller, int $no, string $species, int $qty, int $startPrice, string $thumbnailPath): Item
    {
        $item = Item::create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $seller->id,
            'item_number' => $no,
            'seller_display_order' => $no,
            'species_name' => $species,
            'quantity' => $qty,
            'start_price' => $startPrice,
            'current_price' => $startPrice,
            'reserve_price' => (int) ($startPrice * 0.8),
            'estimated_price' => (int) ($startPrice * 1.5),
            'bid_increment' => 100,
            'inspection_info' => "健康状態：良好\n餌食い：良好",
            'individual_info' => "性別：不明\n月齢：約3ヶ月",
            'notes' => '配送料パターン検証用のダミーデータです。',
            'is_premium' => false,
            'premium_fee' => 0,
            'thumbnail_path' => $thumbnailPath,
            'status' => 'sold',
        ]);

        DB::table('item_media')->insert([
            'item_id' => $item->id,
            'media_type' => 'photo_top',
            'file_path' => $thumbnailPath,
            'file_name' => basename($thumbnailPath),
            'mime_type' => str_ends_with($thumbnailPath, '.png') ? 'image/png' : 'image/jpeg',
            'display_order' => 1,
            'is_thumbnail' => true,
            'uploaded_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $item;
    }

    /**
     * WonItem 属性配列を組み立てる（DB には書き込まない）。
     */
    private function buildWonItem(Item $item, User $winner, int $winningPrice, array $overrides = []): array
    {
        $commissionRate = 10;
        $commissionAmount = (int) round($winningPrice * $commissionRate / 100);

        $base = [
            'item_id' => $item->id,
            'winner_id' => $winner->id,
            'winning_price' => $winningPrice,
            'quantity' => $item->quantity,
            'commission_rate' => $commissionRate,
            'commission_amount' => $commissionAmount,
            'seller_amount' => $winningPrice - $commissionAmount,
            'shipping_fee' => 0,
            'shipping_breakdown' => null,
            'payment_status' => 'pending',
            'payment_method' => 'bank_transfer',
            'delivery_status' => 'pending',
            'delivery_method' => 'shipping',
            'payment_deadline' => now()->addDay(),
            'shipping_postal_code' => $winner->postal_code,
            'shipping_prefecture' => $winner->prefecture,
            'shipping_city' => $winner->city,
            'shipping_address_line1' => $winner->address_line1,
            'shipping_address_line2' => $winner->address_line2,
            'shipping_name' => $winner->name,
            'shipping_phone' => $winner->phone,
        ];

        return array_merge($base, $overrides);
    }

    /**
     * (auction × winner) の WonItem 群について ShippingCalculatorService で送料を算出・按分し、
     * group 共通のステータス overrides を全件に適用して保存する。
     */
    private function persistGroup(array $wonItemRows, User $winner, ShippingCalculatorService $shipping, array $statusOverrides): void
    {
        if (empty($wonItemRows)) return;

        $region = $shipping->getRegionByPrefecture($winner->prefecture);
        if (!$region) {
            $this->command->warn(sprintf(
                'User(id=%d) の都道府県「%s」から配送地域を特定できません。送料=0 で登録します。',
                $winner->id,
                $winner->prefecture
            ));
            foreach ($wonItemRows as $row) {
                $row = array_merge($row, $statusOverrides);
                $row['total_amount'] = $row['winning_price'] + $row['commission_amount'];
                (new WonItem())->forceFill($row)->save();
            }
            return;
        }

        $quantities = array_map(fn ($row) => (int) $row['quantity'], $wonItemRows);
        $items = array_map(fn ($q) => ['quantity' => $q], $quantities);
        $result = $shipping->calculate($items, $region);
        $apportioned = ShippingCalculatorService::apportionFee($result['total_shipping_fee'], $quantities);

        foreach ($wonItemRows as $i => $row) {
            $row = array_merge($row, $statusOverrides);
            $shippingFee = $apportioned[$i];
            $row['shipping_fee'] = $shippingFee;
            $row['shipping_breakdown'] = $result;
            $row['shipping_calculated_at'] = now();
            $row['total_amount'] = $row['winning_price'] + $row['commission_amount'] + $shippingFee;

            (new WonItem())->forceFill($row)->save();
        }
    }

    private function report(): void
    {
        $this->command->info('✓ ShippingPatternsSeeder 完了');
        $auctions = Auction::where('title', 'like', self::TITLE_PREFIX . '%')->get();
        foreach ($auctions as $a) {
            $count = WonItem::whereHas('item', fn ($q) => $q->where('auction_id', $a->id))->count();
            $this->command->info(sprintf('  - %s (id=%d, won=%d)', $a->title, $a->id, $count));
        }
    }
}
