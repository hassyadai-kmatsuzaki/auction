<?php

namespace Database\Seeders;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\Role;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * docs/E2Eテスト仕様書_落札後帳票.md の PAR-PO / SEL-PO / ADM-PO / DOC / NTF を
 * 手動検証するための最小データセット。
 *
 *  - 落札者 X = User(id=516)
 *  - 落札者 Y / Z = 既存 participant からランダムに2名
 *  - 出品者 A / B = 既存 seller_profile の先頭2件
 *  - Auction #PAST-1（3日前終了）/ #PAST-2（1日前終了 / 送料未計算）
 *    / #PAST-3（12時間前終了 / 入金期限2時間後 → 催促対象）
 *
 * 再実行安全: タイトル先頭 [E2E-POST-AUCTION] のレコードを掃除してから投入する。
 */
class PostAuctionE2ESeeder extends Seeder
{
    private const TITLE_PREFIX = '[E2E-POST-AUCTION]';
    private const PRIMARY_WINNER_ID = 516;

    private array $medakaImages = [
        '/img/medaka/紅白ラメ.jpg',
        '/img/medaka/幹之フルボディ.jpg',
        '/img/medaka/楊貴妃ダルマ.jpeg',
        '/img/medaka/三色ラメ.jpeg',
        '/img/medaka/オロチ.jpg',
        '/img/medaka/夜桜ゴールド.jpg',
        '/img/medaka/01.png',
        '/img/medaka/02.png',
        '/img/medaka/03.png',
        '/img/medaka/04.png',
        '/img/medaka/05.png',
        '/img/medaka/06.png',
    ];

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
        $this->ensureParticipantRole($winnerX);

        $sellerProfiles = SellerProfile::orderBy('id')->limit(2)->get();
        if ($sellerProfiles->count() < 1) {
            $this->command->error('seller_profile が 1 件もありません。DemoDataSeeder で出品者を先に作成してください。');
            return;
        }
        $sellerA = $sellerProfiles->first();
        $sellerB = $sellerProfiles->count() >= 2 ? $sellerProfiles->get(1) : $sellerA;

        $otherParticipants = User::whereHas('roles', fn ($q) => $q->where('name', 'participant'))
            ->where('id', '!=', $winnerX->id)
            ->inRandomOrder()
            ->limit(2)
            ->get();
        if ($otherParticipants->count() < 2) {
            $this->command->warn('他の participant が2名未満です。Y/Z 用の落札データは作成しません。');
        }
        $winnerY = $otherParticipants->get(0);
        $winnerZ = $otherParticipants->get(1);

        DB::transaction(function () use ($admin, $winnerX, $winnerY, $winnerZ, $sellerA, $sellerB) {
            $this->cleanupExisting();

            $past1 = $this->createAuction($admin, 'PAST-1', now()->subDays(3));
            $past2 = $this->createAuction($admin, 'PAST-2', now()->subDay());
            $past3 = $this->createAuction($admin, 'PAST-3', now()->subHours(12));

            // PAST-1: X が 2 件落札（1件は paid/未確認、1件は confirmed/preparing）/ Y・Z にも 1件ずつ
            $p1a = $this->createItem($past1, $sellerA, 1, '紅白ラメ ペア', 2, 5000, '/img/medaka/紅白ラメ.jpg', 'sold');
            $p1b = $this->createItem($past1, $sellerA, 2, '幹之フルボディ', 1, 3000, '/img/medaka/幹之フルボディ.jpg', 'sold');
            $p1c = $this->createItem($past1, $sellerB, 3, '楊貴妃ダルマ', 1, 2500, '/img/medaka/楊貴妃ダルマ.jpeg', 'sold');
            $p1d = $this->createItem($past1, $sellerB, 4, '三色ラメ', 3, 4000, '/img/medaka/三色ラメ.jpeg', 'sold');

            $this->createWonItem($p1a, $winnerX, [
                'winning_price' => 8500,
                'payment_status' => 'paid',
                'delivery_status' => 'pending',
                'paid_at' => now()->subDays(1),
                'payment_deadline' => now()->addDays(1),
                'shipping_fee' => 957,
                'shipping_calculated_at' => now()->subDays(1),
            ]);
            $this->createWonItem($p1b, $winnerX, [
                'winning_price' => 4500,
                'payment_status' => 'confirmed',
                'delivery_status' => 'preparing',
                'paid_at' => now()->subDays(2),
                'payment_confirmed_at' => now()->subDays(1),
                'payment_deadline' => now()->subDays(1),
                'shipping_locked_at' => now()->subDays(1),
                'shipping_fee' => 847,
                'shipping_calculated_at' => now()->subDays(2),
            ]);
            if ($winnerY) {
                $this->createWonItem($p1c, $winnerY, [
                    'winning_price' => 3200,
                    'payment_status' => 'confirmed',
                    'delivery_status' => 'shipped',
                    'paid_at' => now()->subDays(2),
                    'payment_confirmed_at' => now()->subDays(2),
                    'payment_deadline' => now()->subDays(1),
                    'shipping_locked_at' => now()->subDays(2),
                    'shipping_fee' => 847,
                    'shipping_calculated_at' => now()->subDays(2),
                    'shipped_at' => now()->subDay(),
                    'shipping_company' => 'ヤマト運輸',
                    'tracking_number' => '1234-5678-9012',
                ]);
            }
            if ($winnerZ) {
                $this->createWonItem($p1d, $winnerZ, [
                    'winning_price' => 6000,
                    'payment_status' => 'confirmed',
                    'delivery_status' => 'completed',
                    'paid_at' => now()->subDays(3),
                    'payment_confirmed_at' => now()->subDays(3),
                    'payment_deadline' => now()->subDays(2),
                    'shipping_locked_at' => now()->subDays(3),
                    'shipping_fee' => 1023,
                    'shipping_calculated_at' => now()->subDays(3),
                    'shipped_at' => now()->subDays(2),
                    'delivered_at' => now()->subDay(),
                    'shipping_company' => '佐川急便',
                    'tracking_number' => '9876-5432-1098',
                ]);
            }

            // PAST-2: X が 1 件落札 / 送料未計算 / 入金前
            $p2a = $this->createItem($past2, $sellerA, 1, '夜桜ゴールド', 2, 3500, '/img/medaka/夜桜ゴールド.jpg', 'sold');
            $this->createItem($past2, $sellerA, 2, 'オロチ（流札）', 1, 8000, '/img/medaka/オロチ.jpg', 'unsold');
            $this->createWonItem($p2a, $winnerX, [
                'winning_price' => 5500,
                'payment_status' => 'pending',
                'delivery_status' => 'pending',
                'payment_deadline' => now()->addDay(),
                'shipping_fee' => 0,
                'shipping_calculated_at' => null,
            ]);

            // PAST-3: X が 2 件落札 / 催促対象
            //   a: 入金期限 = now()+2h → NTF-6（24時間以内）urgency で催促
            //   b: 入金期限 = now()+30m → NTF-7（1時間以内）urgency で催促
            $p3a = $this->createItem($past3, $sellerB, 1, '01 メダカ', 5, 1000, '/img/medaka/01.png', 'sold');
            $p3b = $this->createItem($past3, $sellerB, 2, '02 メダカ', 3, 1500, '/img/medaka/02.png', 'sold');
            $this->createWonItem($p3a, $winnerX, [
                'winning_price' => 1800,
                'payment_status' => 'pending',
                'delivery_status' => 'pending',
                'payment_deadline' => now()->addHours(2),
                'shipping_fee' => 704,
                'shipping_calculated_at' => now()->subHours(6),
            ]);
            $this->createWonItem($p3b, $winnerX, [
                'winning_price' => 2200,
                'payment_status' => 'pending',
                'delivery_status' => 'pending',
                'payment_deadline' => now()->addMinutes(30),
                'shipping_fee' => 704,
                'shipping_calculated_at' => now()->subHours(6),
            ]);
        });

        $this->report($winnerX, $winnerY, $winnerZ);
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

    private function createAuction(User $admin, string $label, Carbon $eventDate): Auction
    {
        $auction = Auction::create([
            'title' => sprintf('%s #%s E2E検証用オークション', self::TITLE_PREFIX, $label),
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

    private function createItem(Auction $auction, SellerProfile $seller, int $no, string $species, int $qty, int $startPrice, string $thumbnailPath, string $status): Item
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

    private function createWonItem(Item $item, User $winner, array $overrides): WonItem
    {
        $winningPrice = $overrides['winning_price'] ?? (int) $item->start_price;
        $quantity = $item->quantity;
        $commissionRate = 10;
        $commissionAmount = (int) round($winningPrice * $commissionRate / 100);
        $shippingFee = $overrides['shipping_fee'] ?? 0;

        $defaults = [
            'item_id' => $item->id,
            'winner_id' => $winner->id,
            'winning_price' => $winningPrice,
            'quantity' => $quantity,
            'total_amount' => $winningPrice + $commissionAmount + $shippingFee,
            'commission_rate' => $commissionRate,
            'commission_amount' => $commissionAmount,
            'seller_amount' => $winningPrice - $commissionAmount,
            'shipping_fee' => $shippingFee,
            'shipping_breakdown' => $shippingFee > 0 ? [
                'region' => '関東',
                'box_size' => 100,
                'shipping_fee' => $shippingFee,
                'packing_fee' => 350,
                'total_shipping_fee' => $shippingFee,
            ] : null,
            'payment_status' => 'pending',
            'delivery_status' => 'pending',
            'delivery_method' => 'shipping',
            'payment_deadline' => now()->addDay(),
            'shipping_postal_code' => '150-0002',
            'shipping_prefecture' => '東京都',
            'shipping_city' => '渋谷区',
            'shipping_address_line1' => '渋谷1-2-3',
            'shipping_name' => $winner->name,
            'shipping_phone' => '090-1234-5678',
        ];

        $data = array_merge($defaults, $overrides);
        if ($shippingFee > 0 && !array_key_exists('shipping_breakdown', $overrides)) {
            $data['shipping_breakdown'] = $defaults['shipping_breakdown'];
        }
        if ($shippingFee > 0) {
            $data['total_amount'] = $winningPrice + $commissionAmount + $shippingFee;
        }

        // shipping_calculated_at は WonItem::$fillable 外のため forceFill で書き込む
        $wonItem = new WonItem();
        $wonItem->forceFill($data)->save();
        return $wonItem;
    }

    private function report(User $winnerX, ?User $winnerY, ?User $winnerZ): void
    {
        $this->command->info('✓ PostAuctionE2ESeeder 完了');
        $this->command->info(sprintf('  落札者 X: %s (id=%d)', $winnerX->email, $winnerX->id));
        if ($winnerY) $this->command->info(sprintf('  落札者 Y: %s (id=%d)', $winnerY->email, $winnerY->id));
        if ($winnerZ) $this->command->info(sprintf('  落札者 Z: %s (id=%d)', $winnerZ->email, $winnerZ->id));
        $auctions = Auction::where('title', 'like', self::TITLE_PREFIX . '%')->get();
        foreach ($auctions as $a) {
            $this->command->info(sprintf('  - %s (id=%d, event_date=%s)', $a->title, $a->id, $a->event_date));
        }
    }
}
