<?php

namespace Database\Seeders;

use App\Models\Plan;
use App\Models\Role;
use App\Models\Subscription;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * 負荷テスト用 Subscription Seeder
 *
 * load-tests/scripts/bid-*.js が前提とする participant1@example.com 〜
 * participant100@example.com に対して、入札可能な active サブスクリプションを
 * 冪等に付与する。
 *
 * ■ 非破壊: 既存ユーザーやサブスクリプションを削除しない
 * ■ 冪等: 何度実行しても同じ結果（updateOrCreate / firstOrCreate）
 * ■ 安全: 本番でも実行可能（ただし実際は staging で使う想定）
 *
 * 前提: 対象ユーザーは DemoDataSeeder などで作成済み。本 Seeder は
 *       「サブスクが無い / 期限切れ / allows_bid=false」のケースを修正する。
 *
 * 使い方:
 *   php artisan db:seed --class=LoadTestSubscriptionSeeder
 */
class LoadTestSubscriptionSeeder extends Seeder
{
    private const PLAN_CODE = 'loadtest_full';
    private const TARGET_EMAIL_PREFIX = 'participant';
    private const TARGET_EMAIL_DOMAIN = '@example.com';
    private const TARGET_USER_COUNT = 100;

    public function run(): void
    {
        $this->command->info('=== LoadTestSubscriptionSeeder 開始 ===');

        DB::transaction(function () {
            $plan = $this->ensurePlan();
            $this->ensureParticipantRoleAttached();

            $configured = 0;
            $missing = [];

            for ($i = 1; $i <= self::TARGET_USER_COUNT; $i++) {
                $email = self::TARGET_EMAIL_PREFIX . $i . self::TARGET_EMAIL_DOMAIN;
                $user = User::where('email', $email)->first();

                if (!$user) {
                    $missing[] = $email;
                    continue;
                }

                $this->ensureActiveSubscription($user, $plan);
                $configured++;
            }

            $this->command->info("✓ active サブスクリプションを設定: {$configured}名");

            if (count($missing) > 0) {
                $this->command->warn(sprintf(
                    '⚠ 未存在ユーザー: %d件（DemoDataSeeder を実行して作成してください）',
                    count($missing)
                ));
                foreach (array_slice($missing, 0, 5) as $m) {
                    $this->command->warn("  - {$m}");
                }
                if (count($missing) > 5) {
                    $this->command->warn('  - ... ほか ' . (count($missing) - 5) . '件');
                }
            }
        });

        $this->command->info('=== LoadTestSubscriptionSeeder 完了 ===');
    }

    private function ensurePlan(): Plan
    {
        return Plan::updateOrCreate(
            ['code' => self::PLAN_CODE],
            [
                'name' => '負荷テスト用フルプラン',
                'description' => 'k6 負荷テスト専用。allows_bid=true / amount=0。本番課金には使わない。',
                'amount' => 0,
                'allows_bid' => true,
                'allows_sell' => false,
                'is_active' => true,
                'sort_order' => 9999,
            ]
        );
    }

    private function ensureParticipantRoleAttached(): void
    {
        // 既存ユーザーが participant ロールを持っていない場合の保険
        $role = Role::where('name', 'participant')->first();
        if (!$role) {
            return;
        }
        for ($i = 1; $i <= self::TARGET_USER_COUNT; $i++) {
            $email = self::TARGET_EMAIL_PREFIX . $i . self::TARGET_EMAIL_DOMAIN;
            $user = User::where('email', $email)->first();
            if ($user && !$user->roles()->where('role_id', $role->id)->exists()) {
                $user->roles()->attach($role->id);
            }
        }
    }

    private function ensureActiveSubscription(User $user, Plan $plan): void
    {
        $existing = Subscription::where('user_id', $user->id)
            ->where('plan_id', $plan->id)
            ->first();

        if ($existing) {
            // 期限切れや非activeなら更新
            $needsUpdate =
                $existing->status !== Subscription::STATUS_ACTIVE
                || !$existing->current_period_end
                || $existing->current_period_end->isPast();

            if ($needsUpdate) {
                $existing->update([
                    'status'               => Subscription::STATUS_ACTIVE,
                    'current_period_start' => now(),
                    'current_period_end'   => Carbon::now()->addYear(),
                    'canceled_at'          => null,
                    'suspended_at'         => null,
                    'suspended_reason'     => null,
                ]);
            }
            return;
        }

        Subscription::create([
            'user_id'              => $user->id,
            'plan_id'              => $plan->id,
            'status'               => Subscription::STATUS_ACTIVE,
            'current_period_start' => now(),
            'current_period_end'   => Carbon::now()->addYear(),
        ]);
    }
}
