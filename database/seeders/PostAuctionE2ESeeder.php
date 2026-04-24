<?php

namespace Database\Seeders;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\Role;
use App\Models\SellerProfile;
use App\Models\SpeciesType;
use App\Models\User;
use App\Models\WonItem;
use App\Services\ShippingCalculatorService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * docs/E2Eテスト仕様書_落札後帳票.md の PAR-PO / SEL-PO / ADM-PO / DOC / NTF を
 * 手動検証するための最小データセット。
 *
 *  - 落札者 = User(id=516) のみ
 *  - 出品者 A / B = 既存 seller_profile の先頭2件
 *  - Auction #PAST-1（3日前終了）/ #PAST-2（1日前終了 / 送料未計算）
 *    / #PAST-3（12時間前終了 / 入金期限2時間後 → 催促対象）
 *
 * 配送先は User(id=516) に登録された住所 (postal_code/prefecture/city/
 * address_line1/address_line2/phone) をそのまま転写する。
 * 送料は ShippingCalculatorService に住所地域とアイテム数量を渡して算出し、
 * apportionFee() で各 WonItem に按分する。
 *
 * 再実行安全: タイトル先頭 [E2E-POST-AUCTION] のレコードを掃除してから投入する。
 */
class PostAuctionE2ESeeder extends Seeder
{
    private const TITLE_PREFIX = '[E2E-POST-AUCTION]';
    private const PRIMARY_WINNER_ID = 516;

    public function run(): void
    {
        $admin = User::whereHas('roles', fn ($q) => $q->where('name', 'admin'))->orderBy('id')->first();
        if (!$admin) {
            $this->command->error('admin ユーザーが見つかりません。AdminUserSeeder を先に実行してください。');
            return;
        }

        $winnerX = User::find(self::PRIMARY_WINNER_ID);
        if (!$winnerX) {
            $this->command->error(sprintf('User(id=%d) が存在しません。seeder を中止します。', self::PRIMARY_WINNER_ID));
            return;
        }
        if (!$this->hasShippingAddress($winnerX)) {
            $this->command->error(sprintf(
                'User(id=%d) に配送先住所 (prefecture/city/address_line1) が登録されていません。プロフィール登録後に再実行してください。',
                $winnerX->id
            ));
            return;
        }
        $this->ensureParticipantRole($winnerX);

        $sellerProfiles = SellerProfile::orderBy('id')->limit(2)->get();
        if ($sellerProfiles->count() < 1) {
            $this->command->error('seller_profile が 1 件もありません。DemoDataSeeder で出品者を先に作成してください。');
            return;
        }
        $sellerA = $sellerProfiles->first();
        $sellerB = $sellerProfiles->count() >= 2 ? $sellerProfiles->get(1) : $sellerA;

        $shipping = app(ShippingCalculatorService::class);

        DB::transaction(function () use ($admin, $winnerX, $sellerA, $sellerB, $shipping) {
            $this->cleanupExisting();

            // 仕様: 同一 (auction × winner) 内ではステータスを統一する。
            // PAST-1 で 4 状態を網羅する必要があるため、各状態を別オークションに分割する。
            $past1a = $this->createAuction($admin, 'PAST-1A', now()->subDays(3), '入金済み・確認待ち');
            $past1b = $this->createAuction($admin, 'PAST-1B', now()->subDays(3), '入金確認済み・発送準備中');
            $past1c = $this->createAuction($admin, 'PAST-1C', now()->subDays(3), '発送済み');
            $past1d = $this->createAuction($admin, 'PAST-1D', now()->subDays(3), '配達完了');
            $past2  = $this->createAuction($admin, 'PAST-2',  now()->subDay(),   '送料未計算');
            $past3  = $this->createAuction($admin, 'PAST-3',  now()->subHours(12), '催促対象');

            // PAST-1A: paid / pending
            $p1a = $this->createItem($past1a, $sellerA, 1, '紅白ラメ ペア', 2, 5000, '/img/medaka/紅白ラメ.jpg', 'sold');
            $this->persistWithCalculatedShipping([
                $this->buildWonItem($p1a, $winnerX, 8500, [
                    'payment_status' => 'paid',
                    'delivery_status' => 'pending',
                    'paid_at' => now()->subDays(1),
                    'payment_deadline' => now()->addDays(1),
                ]),
            ], $winnerX, $shipping);

            // PAST-1B: confirmed / preparing
            $p1b = $this->createItem($past1b, $sellerA, 1, '幹之フルボディ', 1, 3000, '/img/medaka/幹之フルボディ.jpg', 'sold');
            $this->persistWithCalculatedShipping([
                $this->buildWonItem($p1b, $winnerX, 4500, [
                    'payment_status' => 'confirmed',
                    'delivery_status' => 'preparing',
                    'paid_at' => now()->subDays(2),
                    'payment_confirmed_at' => now()->subDays(1),
                    'payment_deadline' => now()->subDays(1),
                    'shipping_locked_at' => now()->subDays(1),
                ]),
            ], $winnerX, $shipping);

            // PAST-1C: confirmed / shipped
            $p1c = $this->createItem($past1c, $sellerB, 1, '楊貴妃ダルマ', 1, 2500, '/img/medaka/楊貴妃ダルマ.jpeg', 'sold');
            $this->persistWithCalculatedShipping([
                $this->buildWonItem($p1c, $winnerX, 3200, [
                    'payment_status' => 'confirmed',
                    'delivery_status' => 'shipped',
                    'paid_at' => now()->subDays(2),
                    'payment_confirmed_at' => now()->subDays(2),
                    'payment_deadline' => now()->subDays(1),
                    'shipping_locked_at' => now()->subDays(2),
                    'shipped_at' => now()->subDay(),
                    'shipping_company' => 'ヤマト運輸',
                    'tracking_number' => '1234-5678-9012',
                ]),
            ], $winnerX, $shipping);

            // PAST-1D: confirmed / completed
            $p1d = $this->createItem($past1d, $sellerB, 1, '三色ラメ', 3, 4000, '/img/medaka/三色ラメ.jpeg', 'sold');
            $this->persistWithCalculatedShipping([
                $this->buildWonItem($p1d, $winnerX, 6000, [
                    'payment_status' => 'confirmed',
                    'delivery_status' => 'completed',
                    'paid_at' => now()->subDays(3),
                    'payment_confirmed_at' => now()->subDays(3),
                    'payment_deadline' => now()->subDays(2),
                    'shipping_locked_at' => now()->subDays(3),
                    'shipped_at' => now()->subDays(2),
                    'delivered_at' => now()->subDay(),
                    'shipping_company' => '佐川急便',
                    'tracking_number' => '9876-5432-1098',
                ]),
            ], $winnerX, $shipping);

            // PAST-2: 送料未計算ケース（shipping_fee=0 / shipping_calculated_at=null のまま残す）
            $p2a = $this->createItem($past2, $sellerA, 1, '夜桜ゴールド', 2, 3500, '/img/medaka/夜桜ゴールド.jpg', 'sold');
            $this->createItem($past2, $sellerA, 2, 'オロチ（流札）', 1, 8000, '/img/medaka/オロチ.jpg', 'unsold');
            $this->persistWithoutShipping([
                $this->buildWonItem($p2a, $winnerX, 5500, [
                    'payment_status' => 'pending',
                    'delivery_status' => 'pending',
                    'payment_deadline' => now()->addDay(),
                ]),
            ], $winnerX);

            // PAST-3: 催促対象（24h 以内 / 1h 以内の両方）。落札者単位でステータスは統一。
            $p3a = $this->createItem($past3, $sellerB, 1, '01 メダカ', 5, 1000, '/img/medaka/01.png', 'sold');
            $p3b = $this->createItem($past3, $sellerB, 2, '02 メダカ', 3, 1500, '/img/medaka/02.png', 'sold');
            $wx3 = [
                $this->buildWonItem($p3a, $winnerX, 1800, [
                    'payment_status' => 'pending',
                    'delivery_status' => 'pending',
                    'payment_deadline' => now()->addMinutes(30),
                ]),
                $this->buildWonItem($p3b, $winnerX, 2200, [
                    'payment_status' => 'pending',
                    'delivery_status' => 'pending',
                    'payment_deadline' => now()->addMinutes(30),
                ]),
            ];
            $this->persistWithCalculatedShipping($wx3, $winnerX, $shipping);
        });

        $this->report($winnerX);
    }

    private function hasShippingAddress(User $user): bool
    {
        return filled($user->prefecture) && filled($user->city) && filled($user->address_line1);
    }

    private function ensureParticipantRole(User $user): void
    {
        $role = Role::where('name', 'participant')->first();
        if ($role && !$user->roles()->where('role_id', $role->id)->exists()) {
            $user->roles()->attach($role->id);
        }
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

    private function createAuction(User $admin, string $label, Carbon $eventDate, ?string $subtitle = null): Auction
    {
        $titleCore = $subtitle
            ? sprintf('%s #%s %s', self::TITLE_PREFIX, $label, $subtitle)
            : sprintf('%s #%s E2E検証用オークション', self::TITLE_PREFIX, $label);

        $auction = Auction::create([
            'title' => $titleCore,
            'event_date' => $eventDate->toDateString(),
            'start_time' => $eventDate->format('H:i:s'),
            'end_time' => $eventDate->copy()->addHour()->format('H:i:s'),
            'status' => 'finished',
            'description' => 'E2E 落札後・帳票・通知検証用のオークションです。',
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

    private function createItem(
        Auction $auction,
        SellerProfile $seller,
        int $no,
        string $species,
        int $qty,
        int $startPrice,
        string $thumbnailPath,
        string $status,
        string $speciesCode = 'medaka',
        string $quantityUnit = 'fish'
    ): Item {
        $speciesType = SpeciesType::where('code', $speciesCode)->first();
        if (!$speciesType) {
            throw new \RuntimeException("SpeciesType code={$speciesCode} が見つかりません。");
        }

        $item = Item::create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $seller->id,
            'item_number' => $no,
            'seller_display_order' => $no,
            'species_name' => $species,
            'species_type_id' => $speciesType->id,
            'quantity' => $qty,
            'quantity_unit' => $quantityUnit,
            'start_price' => $startPrice,
            'current_price' => $startPrice,
            'reserve_price' => (int) ($startPrice * 0.8),
            'estimated_price' => (int) ($startPrice * 1.5),
            'bid_increment' => 100,
            'inspection_info' => "健康状態：良好\n餌食い：良好",
            'individual_info' => "性別：不明\n月齢：約3ヶ月\n体長：約2cm",
            'notes' => 'E2E 検証用のダミーデータです。',
            'is_premium' => false,
            'premium_fee' => 0,
            'thumbnail_path' => $thumbnailPath,
            'status' => $status,
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
     * WonItem の属性配列を組み立てる（DB には書き込まない）。
     * 配送先は $winner の User レコードから転写。送料は 0 / null のまま。
     */
    private function buildWonItem(Item $item, User $winner, int $winningPrice, array $overrides): array
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
            // 本サービスは口座振込のみ。InvoiceService の payment_method 判定で「未定」にならないよう常にセット。
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
     * 同一 (auction, winner) の WonItem 群について ShippingCalculatorService で送料算出→按分→DB書込。
     */
    private function persistWithCalculatedShipping(array $wonItemRows, User $winner, ShippingCalculatorService $shipping): void
    {
        if (empty($wonItemRows)) return;

        $region = $shipping->getRegionByPrefecture($winner->prefecture);
        if (!$region) {
            $this->command->warn(sprintf(
                'User(id=%d) の都道府県「%s」から配送地域を特定できません。送料=0 で登録します。',
                $winner->id,
                $winner->prefecture
            ));
            $this->persistWithoutShipping($wonItemRows, $winner);
            return;
        }

        $quantities = array_map(fn ($row) => (int) $row['quantity'], $wonItemRows);
        $itemIds = array_map(fn ($row) => (int) $row['item_id'], $wonItemRows);
        $speciesMap = Item::whereIn('id', $itemIds)->pluck('species_type_id', 'id')->toArray();
        $items = [];
        foreach ($wonItemRows as $row) {
            $items[] = [
                'quantity' => (int) $row['quantity'],
                'species_type_id' => $speciesMap[$row['item_id']] ?? null,
            ];
        }

        $result = $shipping->calculate($items, $region);
        $mode = $result['calculation_mode'] ?? 'auto';

        if ($mode === 'manual') {
            foreach ($wonItemRows as $row) {
                $row['shipping_fee'] = 0;
                $row['shipping_fee_auto'] = null;
                $row['shipping_breakdown'] = $result;
                $row['calculation_mode'] = 'manual';
                $row['total_amount'] = ($row['winning_price'] * $row['quantity']) + $row['commission_amount'];
                $row['shipping_calculated_at'] = now();
                (new WonItem())->forceFill($row)->save();
            }
            return;
        }

        $apportioned = ShippingCalculatorService::apportionFee($result['total_shipping_fee'], $quantities);

        foreach ($wonItemRows as $i => $row) {
            $shippingFee = $apportioned[$i];
            $row['shipping_fee'] = $shippingFee;
            $row['shipping_fee_auto'] = $shippingFee;
            $row['shipping_breakdown'] = $result;
            $row['calculation_mode'] = $mode;
            $row['total_amount'] = ($row['winning_price'] * $row['quantity']) + $row['commission_amount'];
            $row['shipping_calculated_at'] = now();

            (new WonItem())->forceFill($row)->save();
        }
    }

    /**
     * 送料未計算のまま WonItem を作成する（PAST-2 ケース用）。
     */
    private function persistWithoutShipping(array $wonItemRows, User $winner): void
    {
        foreach ($wonItemRows as $row) {
            $row['total_amount'] = ($row['winning_price'] * $row['quantity']) + $row['commission_amount'];
            $wonItem = new WonItem();
            $wonItem->forceFill($row)->save();
        }
    }

    private function report(User $winnerX): void
    {
        $this->command->info('✓ PostAuctionE2ESeeder 完了');
        $this->command->info(sprintf(
            '  落札者: %s (id=%d) / %s%s%s',
            $winnerX->email,
            $winnerX->id,
            $winnerX->prefecture,
            $winnerX->city,
            $winnerX->address_line1
        ));
        $auctions = Auction::where('title', 'like', self::TITLE_PREFIX . '%')->get();
        foreach ($auctions as $a) {
            $this->command->info(sprintf('  - %s (id=%d, event_date=%s)', $a->title, $a->id, $a->event_date));
        }
    }
}
