<?php

namespace App\Services\Payment;

use App\Mail\SubscriptionPaidAdminMail;
use App\Mail\SubscriptionPaidMail;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * 年会費サブスクリプションのビジネスロジック
 *
 * 採用方式: Card on File + 自前スケジューラによる年次課金
 *  - 新規加入時に即時課金（失敗したら subscription は作らない）
 *  - 年1回 `subscriptions:renew` コマンドで期限切れを検知して再課金
 *  - 失敗 → status=past_due + suspended_at、即停止（仕様どおり）
 */
class SubscriptionService
{
    private const ADMIN_NOTIFICATION_EMAILS = [
        'tshort.m.nakakita@gmail.com',
        'k.matsuzaki@beer-o-clock.jp',
    ];

    public function __construct(
        private readonly SquareClient $square,
    ) {}

    /**
     * プランに応じた有効期限を計算する。
     * duration_days あり（1Day会員などの単発プラン）= 起点 + duration_days 日、なし = 起点 + 1年。
     * 期間計算はここに一本化する（addYear ハードコードを散らさない）。
     */
    private function periodEnd(Plan $plan, \Carbon\CarbonInterface $base): \Carbon\CarbonInterface
    {
        return $plan->duration_days
            ? $base->copy()->addDays($plan->duration_days)
            : $base->copy()->addYear();
    }

    /**
     * 新規加入: カード登録 + 初回課金 + subscription 作成
     *
     * @param User   $user
     * @param Plan   $plan
     * @param string $sourceId   Web Payments SDK が発行したワンタイムトークン
     * @param string|null $verificationToken  SCA検証トークン（あれば）
     * @return Subscription
     * @throws SquareApiException|RuntimeException
     */
    public function subscribe(User $user, Plan $plan, string $sourceId, ?string $verificationToken = null): Subscription
    {
        if (!$this->square->isConfigured()) {
            throw new RuntimeException('Square is not configured');
        }
        if (!$plan->is_active) {
            throw new RuntimeException('このプランは加入できません');
        }
        if ($user->subscription && !in_array($user->subscription->status, [Subscription::STATUS_CANCELED], true)) {
            // 停止中の再開は cardReplace で処理。
            throw new RuntimeException('既にサブスクリプションが存在します');
        }

        // 1) Square Customer 作成（冪等: 既に user に紐付いていれば再利用したいが、初回なので新規作成）
        $customer = $this->square->createCustomer([
            'idempotency_key' => 'cust-' . $user->id . '-' . Str::uuid(),
            'given_name'      => $user->name ?? '',
            'email_address'   => $user->email,
            'phone_number'    => $user->phone ?? null,
            'reference_id'    => 'user-' . $user->id,
        ]);
        $customerId = $customer['id'] ?? null;
        if (!$customerId) {
            throw new RuntimeException('Squareカスタマー作成に失敗しました');
        }

        // 2) カードを Card on File として登録
        $card = $this->square->createCard($sourceId, $customerId, $verificationToken);
        $cardId = $card['id'] ?? null;
        if (!$cardId) {
            throw new RuntimeException('カード登録に失敗しました');
        }

        // 3) 初回課金
        $idempotencyKey = 'pay-' . $user->id . '-' . Str::uuid();
        $amount = (int) $plan->amount;

        $payment = null;
        try {
            $payment = $this->square->chargeCard(
                $customerId,
                $cardId,
                $amount,
                $idempotencyKey,
                [
                    'reference_id' => 'user-' . $user->id . '-signup',
                    'note'         => sprintf('年会費: %s (user_id=%d)', $plan->name, $user->id),
                ]
            );
        } catch (SquareApiException $e) {
            // カードだけ作って失敗したら無効化しておく
            $this->square->disableCard($cardId);
            throw $e;
        }

        $paymentStatus = $payment['status'] ?? 'UNKNOWN';
        $squarePaymentId = $payment['id'] ?? null;

        if ($paymentStatus !== 'COMPLETED' && $paymentStatus !== 'APPROVED') {
            $this->square->disableCard($cardId);
            throw new RuntimeException('決済に失敗しました (status=' . $paymentStatus . ')');
        }

        // 4) DB に subscription + payment を保存
        [$subscription, $paymentRecord] = DB::transaction(function () use ($user, $plan, $customerId, $cardId, $card, $payment, $idempotencyKey, $squarePaymentId, $amount) {
            $now = now();
            $subscription = Subscription::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'plan_id'              => $plan->id,
                    'square_customer_id'   => $customerId,
                    'square_card_id'       => $cardId,
                    'card_brand'           => $card['card_brand'] ?? null,
                    'card_last4'           => $card['last_4'] ?? null,
                    'card_exp_month'       => isset($card['exp_month']) ? str_pad((string) $card['exp_month'], 2, '0', STR_PAD_LEFT) : null,
                    'card_exp_year'        => isset($card['exp_year']) ? (string) $card['exp_year'] : null,
                    'status'               => Subscription::STATUS_ACTIVE,
                    'current_period_start' => $now,
                    'current_period_end'   => $this->periodEnd($plan, $now),
                    'canceled_at'          => null,
                    'suspended_at'         => null,
                    'suspended_reason'     => null,
                ]
            );

            $paymentRecord = Payment::create([
                'subscription_id'  => $subscription->id,
                'user_id'          => $user->id,
                'plan_id'          => $plan->id,
                'square_payment_id' => $squarePaymentId,
                'square_order_id'  => $payment['order_id'] ?? null,
                'idempotency_key'  => $idempotencyKey,
                'amount'           => $amount,
                'currency'         => $this->square->currency(),
                'status'           => Payment::STATUS_COMPLETED,
                'paid_at'          => $now,
                'receipt_url'      => $payment['receipt_url'] ?? null,
                'raw_response'     => $payment,
            ]);

            // カード加入が確定したので、過去に銀行振込モードを試した残りカスのフラグをリセットしておく。
            // これをやらないと SubscriptionController::show() の bank_transfer_pending 判定が真のままになり、
            // 加入直後に振込情報モーダルが誤表示される。
            $user->forceFill([
                'payment_method_preference'  => 'card',
                'bank_transfer_confirmed_at' => null,
            ])->save();

            return [$subscription->fresh('plan'), $paymentRecord];
        });

        $this->sendPaidNotifications($user, $subscription, $paymentRecord, 'new');

        return $subscription;
    }

    /**
     * 銀行振込モードでの加入申請。
     * Square 課金は行わず、subscription/payment を pending で作成し、
     * 管理者が振込確認するまで利用不可状態にしておく。
     */
    public function subscribeWithBankTransfer(User $user, Plan $plan): Subscription
    {
        if (!$plan->is_active) {
            throw new RuntimeException('このプランは加入できません');
        }
        if ($user->subscription && !in_array($user->subscription->status, [Subscription::STATUS_CANCELED], true)) {
            throw new RuntimeException('既にサブスクリプションが存在します');
        }

        return DB::transaction(function () use ($user, $plan) {
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
                    'status'               => Subscription::STATUS_PENDING,
                    'current_period_start' => null,
                    'current_period_end'   => null,
                    'canceled_at'          => null,
                    'suspended_at'         => null,
                    'suspended_reason'     => null,
                ]
            );

            Payment::create([
                'subscription_id'  => $subscription->id,
                'user_id'          => $user->id,
                'plan_id'          => $plan->id,
                'idempotency_key'  => 'bank-' . $user->id . '-' . Str::uuid(),
                'amount'           => (int) $plan->amount,
                'currency'         => 'JPY',
                'method'           => Payment::METHOD_BANK_TRANSFER,
                'status'           => Payment::STATUS_PENDING,
            ]);

            $user->forceFill([
                'payment_method_preference'  => 'bank_transfer',
                'bank_transfer_confirmed_at' => null,
            ])->save();

            return $subscription->fresh('plan');
        });
    }

    /**
     * 年次更新の振込案内を発行する（管理者操作）。
     * subscription は active のまま、bank_transfer_confirmed_at をリセットして
     * ユーザーログイン時に振込情報モーダルを再表示させる。新たな pending payment を作成しておき、
     * 入金確認時に confirmBankTransfer() で完了処理を行う。
     */
    public function prepareBankTransferRenewal(User $user): Subscription
    {
        $subscription = $user->subscription;
        if (!$subscription) {
            throw new RuntimeException('サブスクリプションがありません');
        }
        if ($user->payment_method_preference !== 'bank_transfer') {
            throw new RuntimeException('このユーザーは銀行振込モードではありません');
        }

        return DB::transaction(function () use ($user, $subscription) {
            // 既に未完了の bank_transfer payment が残っていれば再利用する（重複作成を防ぐ）
            $existingPending = Payment::where('user_id', $user->id)
                ->where('method', Payment::METHOD_BANK_TRANSFER)
                ->where('status', Payment::STATUS_PENDING)
                ->exists();

            if (!$existingPending) {
                $plan = $subscription->plan ?? Plan::find($subscription->plan_id);
                Payment::create([
                    'subscription_id'  => $subscription->id,
                    'user_id'          => $user->id,
                    'plan_id'          => $subscription->plan_id,
                    'idempotency_key'  => 'bank-renew-' . $user->id . '-' . Str::uuid(),
                    'amount'           => (int) ($plan?->amount ?? 0),
                    'currency'         => 'JPY',
                    'method'           => Payment::METHOD_BANK_TRANSFER,
                    'status'           => Payment::STATUS_PENDING,
                ]);
            }

            $user->forceFill([
                'bank_transfer_confirmed_at' => null,
            ])->save();

            return $subscription->fresh('plan');
        });
    }

    /**
     * 管理者が振込確認したときの処理。
     * pending の payment を completed に、subscription を active に切り替え、
     * bank_transfer_confirmed_at を打刻して以降のリマインダーを止める。
     */
    public function confirmBankTransfer(User $user): Subscription
    {
        $subscription = $user->subscription;
        if (!$subscription) {
            throw new RuntimeException('サブスクリプションがありません');
        }

        return DB::transaction(function () use ($user, $subscription) {
            $now = now();

            $pending = Payment::where('user_id', $user->id)
                ->where('method', Payment::METHOD_BANK_TRANSFER)
                ->where('status', Payment::STATUS_PENDING)
                ->latest('id')
                ->first();

            if ($pending) {
                $pending->update([
                    'status'  => Payment::STATUS_COMPLETED,
                    'paid_at' => $now,
                ]);
            }

            $base = $subscription->current_period_end && $subscription->current_period_end->isFuture()
                ? $subscription->current_period_end
                : $now;

            $plan = $subscription->plan ?? Plan::find($subscription->plan_id);

            $subscription->update([
                'status'               => Subscription::STATUS_ACTIVE,
                'current_period_start' => $now,
                'current_period_end'   => $plan ? $this->periodEnd($plan, $base) : $base->copy()->addYear(),
                'canceled_at'          => null,
                'suspended_at'         => null,
                'suspended_reason'     => null,
            ]);

            $user->forceFill([
                'bank_transfer_confirmed_at' => $now,
            ])->save();

            return $subscription->fresh('plan');
        });
    }

    /**
     * カード再登録（失効/変更時に呼ばれる）
     */
    public function replaceCard(User $user, string $sourceId, ?string $verificationToken = null): Subscription
    {
        $subscription = $user->subscription;
        if (!$subscription) {
            throw new RuntimeException('サブスクリプションがありません');
        }
        if (!$subscription->square_customer_id) {
            throw new RuntimeException('Squareカスタマーが未登録です');
        }

        // 新カード登録
        $card = $this->square->createCard($sourceId, $subscription->square_customer_id, $verificationToken);
        $newCardId = $card['id'] ?? null;
        if (!$newCardId) {
            throw new RuntimeException('カード登録に失敗しました');
        }

        // 旧カード無効化
        if ($subscription->square_card_id) {
            $this->square->disableCard($subscription->square_card_id);
        }

        $subscription->update([
            'square_card_id' => $newCardId,
            'card_brand'     => $card['card_brand'] ?? null,
            'card_last4'     => $card['last_4'] ?? null,
            'card_exp_month' => isset($card['exp_month']) ? str_pad((string) $card['exp_month'], 2, '0', STR_PAD_LEFT) : null,
            'card_exp_year'  => isset($card['exp_year']) ? (string) $card['exp_year'] : null,
        ]);

        // 停止中なら再開課金を試みる
        if ($subscription->isSuspended()) {
            $fresh = $subscription->fresh('plan');
            $payment = $this->retryCharge($fresh);
            if ($payment->status === \App\Models\Payment::STATUS_COMPLETED) {
                $this->reactivateUser($fresh->fresh());
            }
        }

        return $subscription->fresh('plan');
    }

    /**
     * 年次更新課金（スケジューラから呼ばれる）
     *
     * @return Payment 成功/失敗どちらでも Payment レコードを返す
     */
    public function renew(Subscription $subscription): Payment
    {
        $payment = $this->charge($subscription, 'renewal');

        if ($payment->status === Payment::STATUS_COMPLETED) {
            $fresh = $subscription->fresh('plan', 'user');
            if ($fresh && $fresh->user) {
                $this->sendPaidNotifications($fresh->user, $fresh, $payment, 'renewal');
            }
        }

        return $payment;
    }

    /**
     * 停止状態からの再課金（カード再登録後の自動リトライ用）
     */
    public function retryCharge(Subscription $subscription): Payment
    {
        return $this->charge($subscription, 'retry');
    }

    private function charge(Subscription $subscription, string $context): Payment
    {
        $plan = $subscription->plan ?? Plan::find($subscription->plan_id);
        if (!$plan) {
            throw new RuntimeException('プランが見つかりません');
        }
        if (!$subscription->square_customer_id || !$subscription->square_card_id) {
            throw new RuntimeException('Square 登録情報が不完全です');
        }

        $idempotencyKey = sprintf('%s-%d-%s', $context, $subscription->id, Str::uuid());
        $amount = (int) $plan->amount;

        try {
            $payment = $this->square->chargeCard(
                $subscription->square_customer_id,
                $subscription->square_card_id,
                $amount,
                $idempotencyKey,
                [
                    'reference_id' => 'user-' . $subscription->user_id . '-' . $context,
                    'note'         => sprintf('年会費%s: %s (user_id=%d)', $context === 'renewal' ? '更新' : '再課金', $plan->name, $subscription->user_id),
                ]
            );
        } catch (SquareApiException $e) {
            $failed = Payment::create([
                'subscription_id'  => $subscription->id,
                'user_id'          => $subscription->user_id,
                'plan_id'          => $plan->id,
                'idempotency_key'  => $idempotencyKey,
                'amount'           => $amount,
                'currency'         => $this->square->currency(),
                'status'           => Payment::STATUS_FAILED,
                'failure_reason'   => Str::limit($e->getMessage(), 500),
                'failed_at'        => now(),
                'raw_response'     => ['errors' => $e->errors],
            ]);
            $this->markSuspended($subscription, $e->getMessage());
            return $failed;
        }

        $paymentStatus = $payment['status'] ?? 'UNKNOWN';
        if ($paymentStatus !== 'COMPLETED' && $paymentStatus !== 'APPROVED') {
            $failed = Payment::create([
                'subscription_id'  => $subscription->id,
                'user_id'          => $subscription->user_id,
                'plan_id'          => $plan->id,
                'idempotency_key'  => $idempotencyKey,
                'amount'           => $amount,
                'currency'         => $this->square->currency(),
                'status'           => Payment::STATUS_FAILED,
                'failure_reason'   => '決済未完了: ' . $paymentStatus,
                'failed_at'        => now(),
                'raw_response'     => $payment,
            ]);
            $this->markSuspended($subscription, '決済未完了: ' . $paymentStatus);
            return $failed;
        }

        return DB::transaction(function () use ($subscription, $plan, $payment, $idempotencyKey, $amount) {
            $now = now();
            $record = Payment::create([
                'subscription_id'  => $subscription->id,
                'user_id'          => $subscription->user_id,
                'plan_id'          => $plan->id,
                'square_payment_id' => $payment['id'] ?? null,
                'square_order_id'  => $payment['order_id'] ?? null,
                'idempotency_key'  => $idempotencyKey,
                'amount'           => $amount,
                'currency'         => $this->square->currency(),
                'status'           => Payment::STATUS_COMPLETED,
                'paid_at'          => $now,
                'receipt_url'      => $payment['receipt_url'] ?? null,
                'raw_response'     => $payment,
            ]);

            // 次回更新日をプラン期間ぶん進める（年会費=1年。単発プランはそもそも renew 対象外）
            $base = $subscription->current_period_end && $subscription->current_period_end->isFuture()
                ? $subscription->current_period_end
                : $now;
            $subscription->update([
                'status'               => Subscription::STATUS_ACTIVE,
                'current_period_start' => $now,
                'current_period_end'   => $this->periodEnd($plan, $base),
                'suspended_at'         => null,
                'suspended_reason'     => null,
            ]);

            return $record;
        });
    }

    /**
     * サブスクリプション解約（カードは無効化し、期限まで待たずに canceled 扱い）
     */
    public function cancel(Subscription $subscription, ?string $reason = null): void
    {
        if ($subscription->square_card_id) {
            $this->square->disableCard($subscription->square_card_id);
        }
        $subscription->update([
            'status'           => Subscription::STATUS_CANCELED,
            'canceled_at'      => now(),
            'suspended_reason' => $reason,
        ]);
    }

    /**
     * 停止扱いにする（決済失敗時）
     */
    public function markSuspended(Subscription $subscription, string $reason): void
    {
        $subscription->update([
            'status'           => Subscription::STATUS_SUSPENDED,
            'suspended_at'     => now(),
            'suspended_reason' => Str::limit($reason, 255),
        ]);
        // 仕様: 即停止 → user.is_active=false or status=suspended
        $user = $subscription->user;
        if ($user) {
            $user->forceFill(['is_active' => false, 'status' => 'suspended'])->save();
        }
        Log::warning('Subscription suspended', [
            'subscription_id' => $subscription->id,
            'user_id'         => $subscription->user_id,
            'reason'          => $reason,
        ]);
    }

    /**
     * 停止 → 再開（管理者操作、またはカード再登録 + 再課金成功時）
     */
    public function reactivateUser(Subscription $subscription): void
    {
        $user = $subscription->user;
        if ($user) {
            $user->forceFill(['is_active' => true, 'status' => 'approved'])->save();
        }
    }

    /**
     * クレジット決済完了通知（本人 + 管理者）
     *
     * @param 'new'|'renewal' $kind
     */
    private function sendPaidNotifications(User $user, Subscription $subscription, Payment $payment, string $kind): void
    {
        if (!empty($user->email)) {
            try {
                Mail::to($user->email)->queue(new SubscriptionPaidMail($user, $subscription, $payment, $kind));
            } catch (\Throwable $e) {
                Log::warning('failed to queue subscription paid mail (user)', [
                    'user_id' => $user->id,
                    'kind'    => $kind,
                    'err'     => $e->getMessage(),
                ]);
            }
        }

        foreach (self::ADMIN_NOTIFICATION_EMAILS as $adminEmail) {
            try {
                Mail::to($adminEmail)->queue(new SubscriptionPaidAdminMail($user, $subscription, $payment, $kind));
            } catch (\Throwable $e) {
                Log::warning('failed to queue subscription paid mail (admin)', [
                    'user_id' => $user->id,
                    'admin'   => $adminEmail,
                    'kind'    => $kind,
                    'err'     => $e->getMessage(),
                ]);
            }
        }
    }
}
