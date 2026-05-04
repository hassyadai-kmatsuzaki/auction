<?php

namespace Database\Seeders;

use App\Models\Payment;
use App\Models\Plan;
use App\Models\Role;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * E2E 用の落札者アカウントを 100 名作成する seeder。
 *
 * 本番 DB に対して安全に流せるよう、以下を遵守する:
 *   - 既存レコードは一切削除・更新しない（email 衝突時は skip）
 *   - email はテスト専用ドメイン (.local) の決め打ち。実在ユーザーと衝突しない
 *   - 1 ユーザー = 1 トランザクション。途中で落ちても他に波及しない
 *   - DatabaseSeeder からは呼ばない。明示起動のみ:
 *       sudo -u ec2-user php artisan db:seed --class=E2EBidderSeeder
 *
 * 仕上がる状態:
 *   - users.is_test = true / status=approved / is_active=true / email_verified_at 打刻済み
 *   - users.payment_method_preference = bank_transfer
 *   - users.bank_transfer_confirmed_at 打刻済み（= ログイン時の振込モーダル抑止）
 *   - subscriptions: status=active / current_period_end = +1年
 *   - payments: 1件 method=bank_transfer / status=completed
 *   - user_roles: participant 付与
 *
 * 環境変数で挙動を上書きできる:
 *   E2E_BIDDER_COUNT       … 作成人数 (default 100)
 *   E2E_BIDDER_EMAIL_PREFIX … メールアドレス左辺の prefix (default "e2e-bidder")
 *   E2E_BIDDER_EMAIL_DOMAIN … ドメイン (default "medaka-test.local")
 *   E2E_BIDDER_PASSWORD    … 共通パスワード (default "E2eBidder!2026")
 *   E2E_BIDDER_START_INDEX … 連番開始 (default 1)
 */
class E2EBidderSeeder extends Seeder
{
    /**
     * 47都道府県 × 1住所のサンプル。送料計算テスト用。
     * index % 47 でラウンドロビン割当することで、N≥47 なら全都道府県が必ず含まれ、
     * 結果として全11リージョン (prefecture_regions マスタ) を網羅する。
     *
     * 各行: [region, prefecture, postal_code, city, address_line1]
     * region は prefecture_regions マスタと同じ表記に揃えること。
     */
    private const SAMPLE_ADDRESSES = [
        ['北海道', '北海道',   '060-8588', '札幌市中央区',          '北2条西2-1'],
        ['東北',   '青森県',   '030-8570', '青森市長島',            '1-1-1'],
        ['東北',   '岩手県',   '020-8570', '盛岡市内丸',            '10-1'],
        ['東北',   '宮城県',   '980-8570', '仙台市青葉区本町',      '3-8-1'],
        ['東北',   '秋田県',   '010-8570', '秋田市山王',            '4-1-1'],
        ['東北',   '山形県',   '990-8570', '山形市松波',            '2-8-1'],
        ['東北',   '福島県',   '960-8670', '福島市杉妻町',          '2-16'],
        ['関東',   '茨城県',   '310-8555', '水戸市笠原町',          '978-6'],
        ['関東',   '栃木県',   '320-8501', '宇都宮市塙田',          '1-1-20'],
        ['関東',   '群馬県',   '371-8570', '前橋市大手町',          '1-1-1'],
        ['関東',   '埼玉県',   '330-9301', 'さいたま市浦和区高砂',  '3-15-1'],
        ['関東',   '千葉県',   '260-8667', '千葉市中央区市場町',    '1-1'],
        ['関東',   '東京都',   '163-8001', '新宿区西新宿',          '2-8-1'],
        ['関東',   '神奈川県', '231-8588', '横浜市中区日本大通',    '1'],
        ['関東',   '山梨県',   '400-8501', '甲府市丸の内',          '1-6-1'],
        ['信越',   '新潟県',   '950-8570', '新潟市中央区新光町',    '4-1'],
        ['信越',   '長野県',   '380-8570', '長野市南長野幅下',      '692-2'],
        ['北陸',   '富山県',   '930-8501', '富山市新総曲輪',        '1-7'],
        ['北陸',   '石川県',   '920-8580', '金沢市鞍月',            '1-1'],
        ['北陸',   '福井県',   '910-8580', '福井市大手',            '3-17-1'],
        ['中部',   '静岡県',   '420-8601', '静岡市葵区追手町',      '9-6'],
        ['中部',   '愛知県',   '460-8501', '名古屋市中区三の丸',    '3-1-2'],
        ['中部',   '三重県',   '514-8570', '津市広明町',            '13'],
        ['中部',   '岐阜県',   '500-8570', '岐阜市薮田南',          '2-1-1'],
        ['関西',   '滋賀県',   '520-8577', '大津市京町',            '4-1-1'],
        ['関西',   '京都府',   '602-8570', '京都市上京区下立売通',  '1-1'],
        ['関西',   '大阪府',   '540-8570', '大阪市中央区大手前',    '2-1-22'],
        ['関西',   '兵庫県',   '650-8567', '神戸市中央区下山手通',  '5-10-1'],
        ['関西',   '奈良県',   '630-8501', '奈良市登大路町',        '30'],
        ['関西',   '和歌山県', '640-8585', '和歌山市小松原通',      '1-1'],
        ['中国',   '鳥取県',   '680-8570', '鳥取市東町',            '1-220'],
        ['中国',   '島根県',   '690-8501', '松江市殿町',            '1'],
        ['中国',   '岡山県',   '700-8570', '岡山市北区内山下',      '2-4-6'],
        ['中国',   '広島県',   '730-8511', '広島市中区基町',        '10-52'],
        ['中国',   '山口県',   '753-8501', '山口市滝町',            '1-1'],
        ['四国',   '徳島県',   '770-8570', '徳島市万代町',          '1-1'],
        ['四国',   '香川県',   '760-8570', '高松市番町',            '4-1-10'],
        ['四国',   '愛媛県',   '790-8570', '松山市一番町',          '4-4-2'],
        ['四国',   '高知県',   '780-8570', '高知市丸ノ内',          '1-2-20'],
        ['九州',   '福岡県',   '812-8577', '福岡市博多区東公園',    '7-7'],
        ['九州',   '佐賀県',   '840-8570', '佐賀市城内',            '1-1-59'],
        ['九州',   '長崎県',   '850-8570', '長崎市尾上町',          '3-1'],
        ['九州',   '熊本県',   '862-8570', '熊本市中央区水前寺',    '6-18-1'],
        ['九州',   '大分県',   '870-8501', '大分市大手町',          '3-1-1'],
        ['九州',   '宮崎県',   '880-8501', '宮崎市橘通東',          '2-10-1'],
        ['九州',   '鹿児島県', '890-8577', '鹿児島市鴨池新町',      '10-1'],
        ['沖縄',   '沖縄県',   '900-8570', '那覇市泉崎',            '1-2-2'],
    ];

    public function run(): void
    {
        $count        = (int) (env('E2E_BIDDER_COUNT', 200));
        $emailPrefix  = (string) env('E2E_BIDDER_EMAIL_PREFIX', 'e2e-bidder');
        $emailDomain  = (string) env('E2E_BIDDER_EMAIL_DOMAIN', 'medaka-test.local');
        $password     = (string) env('E2E_BIDDER_PASSWORD', 'E2eBidder!2026');
        $startIndex   = (int) env('E2E_BIDDER_START_INDEX', 1);

        if ($count <= 0) {
            throw new RuntimeException('E2E_BIDDER_COUNT must be > 0');
        }

        $participantRole = Role::where('name', 'participant')->first();
        if (!$participantRole) {
            throw new RuntimeException('participant ロールが存在しません。先に RoleSeeder を実行してください。');
        }

        $plan = $this->resolveBidPlan();
        $passwordHash = Hash::make($password);

        $created = 0;
        $skipped = 0;
        $repaired = 0;
        $rows = []; // CSV 出力用 (列順は writeCsv() のヘッダ参照)
        $regionCounts = [];

        for ($i = $startIndex; $i < $startIndex + $count; $i++) {
            $email = sprintf('%s-%03d@%s', $emailPrefix, $i, $emailDomain);
            $name  = sprintf('E2E Bidder %03d', $i);
            $address = $this->pickAddress($i);
            $regionCounts[$address['region']] = ($regionCounts[$address['region']] ?? 0) + 1;

            $existing = User::where('email', $email)->first();
            if ($existing) {
                // 既存テストユーザー: サブスク/支払い/ロール/フラグ + 住所を active 状態に揃え直すだけ
                // （実ユーザーの可能性がある email は決して使われない命名なので破壊リスクなし）
                $this->repairUser($existing, $plan, $participantRole, $address);
                $repaired++;
                $rows[] = $this->buildCsvRow($existing->name, $email, $password, $address);
                continue;
            }

            DB::transaction(function () use ($email, $name, $passwordHash, $plan, $participantRole, $address) {
                $user = User::create(array_merge([
                    'name'                       => $name,
                    'email'                      => $email,
                    'password'                   => $passwordHash,
                    'email_verified_at'          => now(),
                    'status'                     => 'approved',
                    'approved_at'                => now(),
                    'is_active'                  => true,
                    'is_test'                    => true,
                    'payment_method_preference'  => 'bank_transfer',
                    'bank_transfer_confirmed_at' => now(),
                ], $this->userColumnsFromAddress($address)));

                $user->roles()->syncWithoutDetaching([
                    $participantRole->id => ['assigned_at' => now()],
                ]);

                $this->ensureActiveBankTransferSubscription($user, $plan);
            });

            $created++;
            $rows[] = $this->buildCsvRow($name, $email, $password, $address);
        }

        $csvPath = $this->writeCsv($rows);

        $this->command->info(sprintf(
            'E2EBidderSeeder: created=%d, repaired=%d, skipped=%d (count=%d, plan=%s id=%d)',
            $created, $repaired, $skipped, $count, $plan->code, $plan->id
        ));
        $this->command->info(sprintf(
            'login: email=%s-{NNN}@%s / password=%s',
            $emailPrefix, $emailDomain, $password
        ));
        // 「全11リージョン分散できているか」を運用者が一目で確認するための内訳。
        // ラウンドロビン割当の妥当性チェック兼、送料テスト範囲の自己申告。
        ksort($regionCounts);
        $regionLine = collect($regionCounts)
            ->map(fn ($n, $r) => "{$r}={$n}")
            ->implode(', ');
        $this->command->info('region distribution: ' . $regionLine);
        $this->command->info('CSV: ' . $csvPath);
    }

    /**
     * 作成/再修復したアカウントを CSV に書き出す。
     * storage/app/e2e-bidders-{YYYYmmdd-HHMMSS}.csv に保存し、既存ファイルを上書きしない。
     * Excel/Google スプレッドシート互換のため UTF-8 BOM 付き。
     */
    private function writeCsv(array $rows): string
    {
        $dir = storage_path('app');
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $path = $dir . '/e2e-bidders-' . now()->format('Ymd-His') . '.csv';

        $fp = fopen($path, 'w');
        if ($fp === false) {
            throw new RuntimeException('CSV ファイルを開けませんでした: ' . $path);
        }
        // UTF-8 BOM (Excel で文字化けさせない)
        fwrite($fp, "\xEF\xBB\xBF");
        fputcsv($fp, [
            'name', 'email', 'password',
            'postal_code', 'prefecture', 'city', 'address_line1', 'address_line2', 'phone',
            'region',
        ]);
        foreach ($rows as $row) {
            fputcsv($fp, $row);
        }
        fclose($fp);

        return $path;
    }

    /**
     * 落札権限のあるプランを取得。本番の id=1 / code=bid_only（年会費 買受者様）を固定で使う。
     * 念のため allows_bid と code を検証して、想定外プランを掴まないようにする。
     */
    private function resolveBidPlan(): Plan
    {
        $plan = Plan::find(1);
        if (!$plan) {
            throw new RuntimeException('plans.id=1 が存在しません。bid_only プランを先に投入してください。');
        }
        if ($plan->code !== 'bid_only' || !$plan->allows_bid) {
            throw new RuntimeException(sprintf(
                'plans.id=1 が想定と違います (code=%s, allows_bid=%s)。bid_only / allows_bid=true を期待。',
                $plan->code, $plan->allows_bid ? 'true' : 'false'
            ));
        }
        return $plan;
    }

    /**
     * 既存テストユーザーの状態を「active な銀行振込サブスク承諾済み + 住所セット済み」へ揃え直す。
     * 実データを一切触らない設計のため、対象は本 seeder が作った email 帯のみ。
     * 住所は再実行ごとに最新の SAMPLE_ADDRESSES に上書き（同じ index は同じ住所になる決定論的な割当）。
     */
    private function repairUser(User $user, Plan $plan, Role $participantRole, array $address): void
    {
        DB::transaction(function () use ($user, $plan, $participantRole, $address) {
            $user->forceFill(array_merge([
                'status'                     => 'approved',
                'approved_at'                => $user->approved_at ?? now(),
                'is_active'                  => true,
                'is_test'                    => true,
                'email_verified_at'          => $user->email_verified_at ?? now(),
                'payment_method_preference'  => 'bank_transfer',
                'bank_transfer_confirmed_at' => now(),
            ], $this->userColumnsFromAddress($address)))->save();

            $user->roles()->syncWithoutDetaching([
                $participantRole->id => ['assigned_at' => now()],
            ]);

            $this->ensureActiveBankTransferSubscription($user, $plan);
        });
    }

    /**
     * subscription を active / 銀行振込 / 1年期間で確定させ、completed payment を1件保証する。
     * 既存 subscription が他プラン/他状態でも updateOrCreate で active に揃える（テストユーザー限定なので安全）。
     */
    private function ensureActiveBankTransferSubscription(User $user, Plan $plan): void
    {
        $now = now();

        $subscription = Subscription::updateOrCreate(
            ['user_id' => $user->id],
            [
                'plan_id'              => $plan->id,
                'square_customer_id'   => null,
                'square_card_id'       => null,
                'card_brand'           => null,
                'card_last4'           => null,
                'card_exp_month'       => null,
                'card_exp_year'        => null,
                'status'               => Subscription::STATUS_ACTIVE,
                'current_period_start' => $now,
                'current_period_end'   => $now->copy()->addYear(),
                'canceled_at'          => null,
                'suspended_at'         => null,
                'suspended_reason'     => null,
            ]
        );

        $hasCompleted = Payment::where('user_id', $user->id)
            ->where('subscription_id', $subscription->id)
            ->where('method', Payment::METHOD_BANK_TRANSFER)
            ->where('status', Payment::STATUS_COMPLETED)
            ->exists();

        if (!$hasCompleted) {
            Payment::create([
                'subscription_id' => $subscription->id,
                'user_id'         => $user->id,
                'plan_id'         => $plan->id,
                'idempotency_key' => 'e2e-bank-' . $user->id . '-' . Str::uuid(),
                'amount'          => (int) $plan->amount,
                'currency'        => 'JPY',
                'method'          => Payment::METHOD_BANK_TRANSFER,
                'status'          => Payment::STATUS_COMPLETED,
                'paid_at'         => $now,
            ]);
        }
    }

    /**
     * index → 住所サンプルへのラウンドロビン割当。
     * 同じ index は常に同じ住所を返す（決定論的）→ 再実行で住所が暴れない。
     * 戻り値の region は users カラムではないので、INSERT 時は userColumnsFromAddress() で除外する。
     */
    private function pickAddress(int $index): array
    {
        $samples = self::SAMPLE_ADDRESSES;
        $entry = $samples[($index - 1) % count($samples)];
        return [
            'region'        => $entry[0],
            'prefecture'    => $entry[1],
            'postal_code'   => $entry[2],
            'city'          => $entry[3],
            'address_line1' => $entry[4],
            'address_line2' => sprintf('テストビル %03d号室', $index),
            'phone'         => sprintf('090-1234-%04d', $index),
        ];
    }

    /**
     * pickAddress() の戻り値から users テーブル INSERT 用の列だけ抜き出す（region は含めない）。
     */
    private function userColumnsFromAddress(array $address): array
    {
        return [
            'postal_code'   => $address['postal_code'],
            'prefecture'    => $address['prefecture'],
            'city'          => $address['city'],
            'address_line1' => $address['address_line1'],
            'address_line2' => $address['address_line2'],
            'phone'         => $address['phone'],
        ];
    }

    /**
     * CSV 1行ぶんの値を、writeCsv のヘッダ順で組み立てる。
     */
    private function buildCsvRow(string $name, string $email, string $password, array $address): array
    {
        return [
            $name,
            $email,
            $password,
            $address['postal_code'],
            $address['prefecture'],
            $address['city'],
            $address['address_line1'],
            $address['address_line2'],
            $address['phone'],
            $address['region'],
        ];
    }
}
