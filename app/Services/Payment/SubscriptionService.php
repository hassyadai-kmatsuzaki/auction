<?php

namespace App\Services\Payment;

use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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
    public function __construct(
        private readonly SquareClient $square,
    ) {}

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
        return DB::transaction(function () use ($user, $plan, $customerId, $cardId, $card, $payment, $idempotencyKey, $squarePaymentId, $amount) {
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
                    'current_period_end'   => $now->copy()->addYear(),
                    'canceled_at'          => null,
                    'suspended_at'         => null,
                    'suspended_reason'     => null,
                ]
            );

            Payment::create([
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
        return $this->charge($subscription, 'renewal');
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

            // 次回更新日を1年後に進める
            $base = $subscription->current_period_end && $subscription->current_period_end->isFuture()
                ? $subscription->current_period_end
                : $now;
            $subscription->update([
                'status'               => Subscription::STATUS_ACTIVE,
                'current_period_start' => $now,
                'current_period_end'   => $base->copy()->addYear(),
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
}
