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
 * 配送料金算出ロジックの代表的なパターンを管理画面で確認するためのデータを投入する。
 *
 * 袋規定: 1-30匹=S / 31-200匹=M / 201-500匹=L / 501+匹=KA
 * 箱容量: 80(S×1) / 100(S×2 or M×1) / 140(S×9, M×3, L×2, KA×1)
 *
 * 網羅するパターン（(auction × winner) グループ単位で 1 パターン）:
 *   [メダカ単独 / auto 戦略]
 *   - 小ロット単発(10匹)                 → 80 箱
 *   - M単独(100匹)                        → 100 箱
 *   - S×3 (30匹×3品)                      → 140 箱 (S×3)
 *   - S+M 混載 (30匹 + 100匹)             → 140 箱
 *   - L 単発 (300匹)                      → 140 箱 (L×1)
 *   - KA 単発 (800匹)                     → 140 箱 (KA×1)
 *   - L×3 (300匹×3品) 複数箱             → 140 箱 ×複数
 *   - 6品の数量按分                       → 按分結果検証
 *   - S×2 (10匹×2品)                      → 100 箱（80 では S×1 のみのため）
 *   - KA+S 同梱 (800+10)                  → 140 箱（KA+S）
 *   - L+S 同梱 (300+10)                   → 140 箱（L+S）
 *   - M×4 (100匹×4品) 複数箱             → 140(M×3) + 100(M×1)
 *   - S×10 (10匹×10品) 複数箱            → 140(S×9) + 80(S×1)
 *
 *   [種別拡張パターン]
 *   - Pattern 14: 「その他」(manual) 単独       → 手動送料入力待ち
 *   - Pattern 15: メダカ + 「その他」の混在      → 全体が manual に倒れる
 *   - Pattern 16: メダカ + 水草（複数 auto 種別） → mixed 戦略で自動計算
 *      ※ 水草マスタが未投入の環境では skip する
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

    /**
     * ⚠ 本 Seeder は固定 ID の User(509, 516) の住所を上書きし、
     *   `[配送料パターン]` プレフィックスの Auction とその関連を delete する。
     *   本番では別人にあたる ID を書き換える可能性があるため abort する。
     */
    public function run(): void
    {
        if (app()->environment('production')) {
            throw new \RuntimeException(
                'ShippingPatternsSeeder は User(id=509, 516) の住所を上書きし '
                . '関連 Auction を delete するため production では実行できません。'
                . ' staging / local でのみ使用してください。'
            );
        }

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

            $small = $this->createAuction($admin, 'SMALL', now()->subDays(6), '小ロット & M単独');
            $mix   = $this->createAuction($admin, 'MIX',   now()->subDays(5), 'S複数 & S+M混載');
            $large = $this->createAuction($admin, 'LARGE', now()->subDays(4), 'L & KA & 複数箱');
            $app   = $this->createAuction($admin, 'APPORTION', now()->subDays(3), '6品按分');
            $extra = $this->createAuction($admin, 'EXTRA', now()->subDays(2), '100箱S×2 / KA+S / L+S / M×4 / S×10');

            // --- Pattern 1: 小ロット単発 (10匹) → 80箱 ---
            $i1 = $this->createItem($small, $sellerA, 1, '紅白メダカ(小ロット)', 10, 200, '/img/medaka/紅白ラメ.jpg');
            $this->persistGroup([$this->buildWonItem($i1, $winners[0], 300)], $winners[0], $shipping, [
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
            $i2 = $this->createItem($small, $sellerA, 2, '幹之フルボディ(M単独)', 100, 500, '/img/medaka/幹之フルボディ.jpg');
            $this->persistGroup([$this->buildWonItem($i2, $winners[1], 700)], $winners[1], $shipping, [
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
            $i3a = $this->createItem($mix, $sellerA, 1, '楊貴妃S-1', 30, 250, '/img/medaka/楊貴妃ダルマ.jpeg');
            $i3b = $this->createItem($mix, $sellerA, 2, '楊貴妃S-2', 30, 250, '/img/medaka/楊貴妃ダルマ.jpeg');
            $i3c = $this->createItem($mix, $sellerA, 3, '楊貴妃S-3', 30, 200, '/img/medaka/楊貴妃ダルマ.jpeg');
            $this->persistGroup([
                $this->buildWonItem($i3a, $winners[2], 400),
                $this->buildWonItem($i3b, $winners[2], 380),
                $this->buildWonItem($i3c, $winners[2], 350),
            ], $winners[2], $shipping, [
                'payment_status' => 'confirmed',
                'delivery_status' => 'preparing',
                'paid_at' => now()->subDays(3),
                'payment_confirmed_at' => now()->subDays(3),
                'shipping_locked_at' => now()->subDays(3),
            ]);

            // --- Pattern 4: S+M 混載 (30匹 + 100匹) → 140箱 ---
            $i4a = $this->createItem($mix, $sellerB, 4, '三色ラメ(S)', 30, 350, '/img/medaka/三色ラメ.jpeg');
            $i4b = $this->createItem($mix, $sellerB, 5, '夜桜ゴールド(M)', 100, 500, '/img/medaka/夜桜ゴールド.jpg');
            $this->persistGroup([
                $this->buildWonItem($i4a, $winners[3], 500),
                $this->buildWonItem($i4b, $winners[3], 700),
            ], $winners[3], $shipping, [
                'payment_status' => 'paid',
                'delivery_status' => 'pending',
                'paid_at' => now()->subDays(1),
                'payment_deadline' => now()->addDay(),
            ]);

            // --- Pattern 5: L単発 (300匹) → 140箱 (L×1) ---
            $i5 = $this->createItem($large, $sellerA, 1, 'オロチ(L単発)', 300, 500, '/img/medaka/オロチ.jpg');
            $this->persistGroup([$this->buildWonItem($i5, $winners[0], 800)], $winners[0], $shipping, [
                'payment_status' => 'pending',
                'delivery_status' => 'pending',
                'payment_deadline' => now()->addDays(2),
            ]);

            // --- Pattern 6: KA単発 (800匹) → 140箱 (KA×1) ---
            $i6 = $this->createItem($large, $sellerA, 2, '出目(KA単発/大量)', 800, 200, '/img/medaka/オロチ.jpg');
            $this->persistGroup([$this->buildWonItem($i6, $winners[4], 300)], $winners[4], $shipping, [
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
            $i7a = $this->createItem($large, $sellerB, 3, '三色L-1', 300, 500, '/img/medaka/三色ラメ.jpeg');
            $i7b = $this->createItem($large, $sellerB, 4, '三色L-2', 300, 520, '/img/medaka/三色ラメ.jpeg');
            $i7c = $this->createItem($large, $sellerB, 5, '三色L-3', 300, 480, '/img/medaka/三色ラメ.jpeg');
            $this->persistGroup([
                $this->buildWonItem($i7a, $winners[1], 800),
                $this->buildWonItem($i7b, $winners[1], 850),
                $this->buildWonItem($i7c, $winners[1], 780),
            ], $winners[1], $shipping, [
                'payment_status' => 'confirmed',
                'delivery_status' => 'preparing',
                'paid_at' => now()->subDays(2),
                'payment_confirmed_at' => now()->subDays(2),
                'shipping_locked_at' => now()->subDays(2),
            ]);

            // --- Pattern 8: 6品 按分 ---
            $i8a = $this->createItem($app, $sellerB, 1, '按分T-1', 10, 150, '/img/medaka/01.png');
            $i8b = $this->createItem($app, $sellerB, 2, '按分T-2', 15, 180, '/img/medaka/02.png');
            $i8c = $this->createItem($app, $sellerB, 3, '按分T-3', 20, 200, '/img/medaka/01.png');
            $i8d = $this->createItem($app, $sellerB, 4, '按分T-4', 25, 220, '/img/medaka/02.png');
            $i8e = $this->createItem($app, $sellerB, 5, '按分T-5', 30, 250, '/img/medaka/01.png');
            $i8f = $this->createItem($app, $sellerB, 6, '按分T-6', 20, 240, '/img/medaka/02.png');
            $this->persistGroup([
                $this->buildWonItem($i8a, $winners[2], 250),
                $this->buildWonItem($i8b, $winners[2], 280),
                $this->buildWonItem($i8c, $winners[2], 300),
                $this->buildWonItem($i8d, $winners[2], 350),
                $this->buildWonItem($i8e, $winners[2], 400),
                $this->buildWonItem($i8f, $winners[2], 380),
            ], $winners[2], $shipping, [
                'payment_status' => 'pending',
                'delivery_status' => 'pending',
                'payment_deadline' => now()->addDay(),
            ]);

            // --- Pattern 9: S×2 (10匹×2品) → 100箱 (S×2) ---
            $i9a = $this->createItem($extra, $sellerA, 1, 'S×2 T-1', 10, 150, '/img/medaka/01.png');
            $i9b = $this->createItem($extra, $sellerA, 2, 'S×2 T-2', 10, 160, '/img/medaka/02.png');
            $this->persistGroup([
                $this->buildWonItem($i9a, $winners[0], 250),
                $this->buildWonItem($i9b, $winners[0], 280),
            ], $winners[0], $shipping, [
                'payment_status' => 'pending',
                'delivery_status' => 'pending',
                'payment_deadline' => now()->addDay(),
            ]);

            // --- Pattern 10: KA+S 同梱 (800 + 10) → 140箱 (KA×1, S×1) ---
            $i10a = $this->createItem($extra, $sellerA, 3, 'KA+S KA側(800)', 800, 200, '/img/medaka/オロチ.jpg');
            $i10b = $this->createItem($extra, $sellerA, 4, 'KA+S S側(10)', 10, 150, '/img/medaka/01.png');
            $this->persistGroup([
                $this->buildWonItem($i10a, $winners[1], 300),
                $this->buildWonItem($i10b, $winners[1], 250),
            ], $winners[1], $shipping, [
                'payment_status' => 'confirmed',
                'delivery_status' => 'shipped',
                'paid_at' => now()->subDays(1),
                'payment_confirmed_at' => now()->subDays(1),
                'shipping_locked_at' => now()->subDays(1),
                'shipped_at' => now(),
                'shipping_company' => 'ヤマト運輸',
                'tracking_number' => 'SP10-1000-0010',
            ]);

            // --- Pattern 11: L+S 同梱 (300 + 10) → 140箱 (L×1, S×1) ---
            $i11a = $this->createItem($extra, $sellerB, 5, 'L+S L側(300)', 300, 500, '/img/medaka/三色ラメ.jpeg');
            $i11b = $this->createItem($extra, $sellerB, 6, 'L+S S側(10)', 10, 150, '/img/medaka/02.png');
            $this->persistGroup([
                $this->buildWonItem($i11a, $winners[2], 900),
                $this->buildWonItem($i11b, $winners[2], 250),
            ], $winners[2], $shipping, [
                'payment_status' => 'paid',
                'delivery_status' => 'pending',
                'paid_at' => now()->subHours(6),
                'payment_deadline' => now()->addDay(),
            ]);

            // --- Pattern 12: M×4 (100匹×4品) → 複数箱 140(M×3) + 100(M×1) ---
            $i12a = $this->createItem($extra, $sellerB, 7,  'M×4 T-1', 100, 500, '/img/medaka/幹之フルボディ.jpg');
            $i12b = $this->createItem($extra, $sellerB, 8,  'M×4 T-2', 100, 520, '/img/medaka/幹之フルボディ.jpg');
            $i12c = $this->createItem($extra, $sellerB, 9,  'M×4 T-3', 100, 540, '/img/medaka/幹之フルボディ.jpg');
            $i12d = $this->createItem($extra, $sellerB, 10, 'M×4 T-4', 100, 560, '/img/medaka/幹之フルボディ.jpg');
            $this->persistGroup([
                $this->buildWonItem($i12a, $winners[3], 700),
                $this->buildWonItem($i12b, $winners[3], 720),
                $this->buildWonItem($i12c, $winners[3], 740),
                $this->buildWonItem($i12d, $winners[3], 760),
            ], $winners[3], $shipping, [
                'payment_status' => 'confirmed',
                'delivery_status' => 'preparing',
                'paid_at' => now()->subDays(1),
                'payment_confirmed_at' => now()->subDays(1),
                'shipping_locked_at' => now()->subDays(1),
            ]);

            // --- Pattern 13: S×10 (10匹×10品) → 複数箱 140(S×9) + 80(S×1) ---
            $i13 = [];
            for ($n = 1; $n <= 10; $n++) {
                $i13[] = $this->createItem(
                    $extra,
                    $sellerA,
                    10 + $n,
                    sprintf('S×10 T-%d', $n),
                    10,
                    150 + $n * 5,
                    '/img/medaka/01.png'
                );
            }
            $this->persistGroup(array_map(
                fn ($item, $idx) => $this->buildWonItem($item, $winners[4], 200 + $idx * 10),
                $i13,
                array_keys($i13)
            ), $winners[4], $shipping, [
                'payment_status' => 'confirmed',
                'delivery_status' => 'completed',
                'paid_at' => now()->subDays(3),
                'payment_confirmed_at' => now()->subDays(3),
                'shipping_locked_at' => now()->subDays(3),
                'shipped_at' => now()->subDays(2),
                'delivered_at' => now()->subDay(),
                'shipping_company' => '佐川急便',
                'tracking_number' => 'SP13-1000-0013',
            ]);

            // --- Pattern 14: 「その他」(manual) 単独 → 手動送料入力待ち ---
            $species = $this->createAuction($admin, 'SPECIES', now()->subHours(12), '種別拡張（その他 / 混在）');
            $i14 = $this->createItem($species, $sellerA, 1, '特殊エビ 5kg パック', 5, 3000, '/img/medaka/01.png', 'other', 'kg');
            $this->persistGroup([$this->buildWonItem($i14, $winners[0], 3500)], $winners[0], $shipping, [
                'payment_status' => 'pending',
                'delivery_status' => 'pending',
                'payment_deadline' => now()->addDays(2),
            ]);

            // --- Pattern 15: メダカ + 「その他」 → manual に倒れる ---
            $i15a = $this->createItem($species, $sellerA, 2, '楊貴妃(メダカ)', 30, 300, '/img/medaka/楊貴妃ダルマ.jpeg', 'medaka', 'fish');
            $i15b = $this->createItem($species, $sellerA, 3, '流木 1 袋(その他)', 1, 1500, '/img/medaka/01.png', 'other', 'bag');
            $this->persistGroup([
                $this->buildWonItem($i15a, $winners[1], 450),
                $this->buildWonItem($i15b, $winners[1], 1800),
            ], $winners[1], $shipping, [
                'payment_status' => 'pending',
                'delivery_status' => 'pending',
                'payment_deadline' => now()->addDays(2),
            ]);

            // --- Pattern 16: メダカ + 水草 (複数 auto 種別) → mixed 戦略（水草マスタがあれば自動計算） ---
            if ($this->isSpeciesReady('aquatic_plant')) {
                $i16a = $this->createItem($species, $sellerB, 4, '幹之(メダカ)', 20, 350, '/img/medaka/幹之フルボディ.jpg', 'medaka', 'fish');
                $i16b = $this->createItem($species, $sellerB, 5, 'アナカリス(水草)', 10, 200, '/img/medaka/01.png', 'aquatic_plant', 'fish');
                $this->persistGroup([
                    $this->buildWonItem($i16a, $winners[2], 500),
                    $this->buildWonItem($i16b, $winners[2], 300),
                ], $winners[2], $shipping, [
                    'payment_status' => 'confirmed',
                    'delivery_status' => 'preparing',
                    'paid_at' => now()->subHours(6),
                    'payment_confirmed_at' => now()->subHours(6),
                    'shipping_locked_at' => now()->subHours(6),
                ]);
            } else {
                $this->command->warn('Pattern 16 (メダカ+水草 mixed) は水草マスタ未投入のためスキップしました。');
            }
        });

        $this->report();
    }

    /**
     * 指定 code の種別が auto 運用可能か（is_active=true かつ袋マスタが存在するか）を判定。
     */
    private function isSpeciesReady(string $code): bool
    {
        $species = SpeciesType::where('code', $code)->where('is_active', true)->first();
        if (!$species) return false;
        return \App\Models\BagSpec::where('species_type_id', $species->id)->exists();
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

    private function createItem(
        Auction $auction,
        SellerProfile $seller,
        int $no,
        string $species,
        int $qty,
        int $startPrice,
        string $thumbnailPath,
        string $speciesCode = 'medaka',
        string $quantityUnit = 'fish'
    ): Item {
        $speciesType = SpeciesType::where('code', $speciesCode)->first();
        if (!$speciesType) {
            throw new \RuntimeException("SpeciesType code={$speciesCode} が見つかりません。マイグレーション＆シードを確認してください。");
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
        $totalBase = $winningPrice * $item->quantity;
        $commissionAmount = (int) round($totalBase * $commissionRate / 100);

        $base = [
            'item_id' => $item->id,
            'winner_id' => $winner->id,
            'winning_price' => $winningPrice,
            'quantity' => $item->quantity,
            'commission_rate' => $commissionRate,
            'commission_amount' => $commissionAmount,
            'seller_amount' => $totalBase - $commissionAmount,
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
                $row['total_amount'] = ($row['winning_price'] * $row['quantity']) + $row['commission_amount'];
                (new WonItem())->forceFill($row)->save();
            }
            return;
        }

        $quantities = array_map(fn ($row) => (int) $row['quantity'], $wonItemRows);
        // WonItem に紐づく Item の species_type_id を同じ順序で取得
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

        // manual の場合は送料を確定せず、管理者手動入力待ちの状態で保存
        if ($mode === 'manual') {
            foreach ($wonItemRows as $row) {
                $row = array_merge($row, $statusOverrides);
                $row['shipping_fee'] = 0;
                $row['shipping_fee_auto'] = null;
                $row['shipping_breakdown'] = $result;
                $row['calculation_mode'] = 'manual';
                $row['shipping_calculated_at'] = now();
                $row['total_amount'] = ($row['winning_price'] * $row['quantity']) + $row['commission_amount'];
                (new WonItem())->forceFill($row)->save();
            }
            return;
        }

        $apportioned = ShippingCalculatorService::apportionFee($result['total_shipping_fee'], $quantities);

        foreach ($wonItemRows as $i => $row) {
            $row = array_merge($row, $statusOverrides);
            $shippingFee = $apportioned[$i];
            $row['shipping_fee'] = $shippingFee;
            $row['shipping_fee_auto'] = $shippingFee;
            $row['shipping_breakdown'] = $result;
            $row['calculation_mode'] = $mode;
            $row['shipping_calculated_at'] = now();
            $row['total_amount'] = ($row['winning_price'] * $row['quantity']) + $row['commission_amount'];

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
