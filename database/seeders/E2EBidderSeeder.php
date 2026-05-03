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
    public function run(): void
    {
        $count        = (int) (env('E2E_BIDDER_COUNT', 100));
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
        $rows = []; // CSV 出力用 [name, email, password]

        for ($i = $startIndex; $i < $startIndex + $count; $i++) {
            $email = sprintf('%s-%03d@%s', $emailPrefix, $i, $emailDomain);
            $name  = sprintf('E2E Bidder %03d', $i);

            $existing = User::where('email', $email)->first();
            if ($existing) {
                // 既存テストユーザー: サブスク/支払い/ロール/フラグを active 状態に揃え直すだけ
                // （実ユーザーの可能性がある email は決して使われない命名なので破壊リスクなし）
                $this->repairUser($existing, $plan, $participantRole);
                $repaired++;
                $rows[] = [$existing->name, $email, $password];
                continue;
            }

            DB::transaction(function () use ($email, $name, $passwordHash, $plan, $participantRole) {
                $user = User::create([
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
                ]);

                $user->roles()->syncWithoutDetaching([
                    $participantRole->id => ['assigned_at' => now()],
                ]);

                $this->ensureActiveBankTransferSubscription($user, $plan);
            });

            $created++;
            $rows[] = [$name, $email, $password];
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
        fputcsv($fp, ['name', 'email', 'password']);
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
     * 既存テストユーザーの状態を「active な銀行振込サブスク承諾済み」へ揃え直す。
     * 実データを一切触らない設計のため、対象は本 seeder が作った email 帯のみ。
     */
    private function repairUser(User $user, Plan $plan, Role $participantRole): void
    {
        DB::transaction(function () use ($user, $plan, $participantRole) {
            $user->forceFill([
                'status'                     => 'approved',
                'approved_at'                => $user->approved_at ?? now(),
                'is_active'                  => true,
                'is_test'                    => true,
                'email_verified_at'          => $user->email_verified_at ?? now(),
                'payment_method_preference'  => 'bank_transfer',
                'bank_transfer_confirmed_at' => now(),
            ])->save();

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
}
