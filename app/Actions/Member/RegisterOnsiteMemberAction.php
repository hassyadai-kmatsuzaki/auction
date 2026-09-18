<?php

namespace App\Actions\Member;

use App\Models\Plan;
use App\Models\Role;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * 当日会員（会場登録）を作成する。
 *
 * 会場で名前・電話番号・パスワードだけを入力し、承認なし・年会費なしで即座に入札できる会員を作る。
 *
 *   - status=approved / is_active=true（承認フローを通さない）
 *   - email は配送不能ドメインの合成値（User::onsiteEmailFor）。MessageSending リスナーが送信を取り消す
 *   - notification_settings は全 false（メール系通知の第2の砦）
 *   - LINE 連携は無い（line_accounts 行が無ければ LINE 通知は構造的に送られない）
 *   - subscriptions に onsite_free（0円・duration_days=30・allows_bid）を active で直接 insert
 *     → CheckSubscription:bid を通過。単発プラン扱いなので再課金されず、期限後は課金なしで canceled になる
 *
 * 決済・通知・E-NE 連携のいずれも呼ばない。DB 書き込みだけで完結する。
 */
class RegisterOnsiteMemberAction
{
    public const PLAN_CODE = 'onsite_free';

    /**
     * @param  array{name: string, phone: string, password: string}  $data  phone は正規化前でよい
     * @throws RuntimeException プラン未投入 / 電話番号重複
     */
    public function execute(array $data): User
    {
        $phoneDigits = User::normalizePhoneDigits($data['phone'] ?? null);
        if ($phoneDigits === '') {
            throw new RuntimeException('電話番号が不正です');
        }

        $plan = Plan::where('code', self::PLAN_CODE)->first();
        if (!$plan) {
            throw new RuntimeException('当日会員プランが登録されていません');
        }

        return DB::transaction(function () use ($data, $phoneDigits, $plan) {
            // 同じ電話番号の当日会員が既にいれば拒否（既存の正会員の電話番号とは衝突させない＝別アカウント）。
            $exists = User::where('is_onsite', true)
                ->where('phone', $phoneDigits)
                ->lockForUpdate()
                ->exists();
            if ($exists) {
                throw new RuntimeException('この電話番号は既に当日会員として登録されています');
            }

            $user = User::create([
                'name'        => trim($data['name']),
                'email'       => User::onsiteEmailFor($phoneDigits),
                'phone'       => $phoneDigits,
                'password'    => Hash::make($data['password']),
                'status'      => 'approved',
                'is_active'   => true,
                'is_test'     => false,
                'is_onsite'   => true,
                'approved_at' => now(),
                'approved_by' => null,
                // メール通知の第2の砦。落札通知・開始通知・指値到達など notification_settings を見る経路を止める
                'notification_settings' => [
                    'email_won_item'          => false,
                    'email_payment_confirmed' => false,
                    'email_shipping'          => false,
                    'email_new_auction'       => false,
                    'email_auction_start'     => false,
                    'email_bid_limit_reached' => false,
                ],
            ]);

            $role = Role::where('name', 'participant')->first();
            if ($role) {
                $user->roles()->attach($role->id, [
                    'assigned_at' => now(),
                    'assigned_by' => null,
                ]);
            }

            $now = now();
            Subscription::create([
                'user_id'              => $user->id,
                'plan_id'              => $plan->id,
                'status'               => Subscription::STATUS_ACTIVE,
                'current_period_start' => $now,
                'current_period_end'   => $now->copy()->addDays((int) ($plan->duration_days ?: 30)),
            ]);

            Log::info('Onsite member registered', [
                'user_id' => $user->id,
                'phone'   => $phoneDigits,
            ]);

            return $user;
        });
    }
}
