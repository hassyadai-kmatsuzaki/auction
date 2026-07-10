<?php

namespace App\Console\Commands;

use App\Models\Subscription;
use App\Services\Payment\SubscriptionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class RenewSubscriptions extends Command
{
    protected $signature = 'subscriptions:renew {--dry-run : 実際には課金せず対象を表示}';
    protected $description = '年会費サブスクリプションの期限切れを検知して再課金する（単発プランは課金せず失効処理）';

    public function handle(SubscriptionService $service): int
    {
        // 年会費プランのみ（dueForRenewal が単発プランを除外している）
        $due = Subscription::dueForRenewal()->with('plan', 'user')->get();

        // 単発プラン（1Day会員）は再課金せず canceled へ遷移させる
        $expired = Subscription::oneShotExpired()->with('plan', 'user')->get();

        $this->info(sprintf('更新対象: %d 件 / 単発プラン失効対象: %d 件', $due->count(), $expired->count()));

        if ($this->option('dry-run')) {
            foreach ($due as $s) {
                $this->line(sprintf(' - [更新] user=%d  plan=%s  current_period_end=%s', $s->user_id, $s->plan->code ?? '-', $s->current_period_end));
            }
            foreach ($expired as $s) {
                $this->line(sprintf(' - [失効] user=%d  plan=%s  current_period_end=%s', $s->user_id, $s->plan->code ?? '-', $s->current_period_end));
            }
            return self::SUCCESS;
        }

        $ok = 0;
        $ng = 0;
        foreach ($due as $subscription) {
            try {
                $payment = $service->renew($subscription);
                if ($payment->status === 'completed') {
                    $ok++;
                    $this->info(sprintf(' OK  user=%d  amount=%d', $subscription->user_id, $payment->amount));
                } else {
                    $ng++;
                    $this->warn(sprintf(' NG  user=%d  reason=%s', $subscription->user_id, $payment->failure_reason));
                }
            } catch (\Throwable $e) {
                $ng++;
                Log::error('Subscription renewal error', ['subscription_id' => $subscription->id, 'err' => $e->getMessage()]);
                $this->error(sprintf(' ERR user=%d  %s', $subscription->user_id, $e->getMessage()));
            }
        }

        $expiredOk = 0;
        foreach ($expired as $subscription) {
            try {
                // cancel() がカード無効化 + status=canceled + canceled_at 打刻まで行う。
                // canceled 化により requires_registration が発火し、次回ログインで再加入モーダルが出る。
                $service->cancel($subscription, Subscription::REASON_ONE_DAY_EXPIRED);
                $expiredOk++;
                $this->info(sprintf(' EXPIRED  user=%d  plan=%s', $subscription->user_id, $subscription->plan->code ?? '-'));
            } catch (\Throwable $e) {
                $ng++;
                Log::error('One-shot subscription expire error', ['subscription_id' => $subscription->id, 'err' => $e->getMessage()]);
                $this->error(sprintf(' ERR user=%d  %s', $subscription->user_id, $e->getMessage()));
            }
        }

        $this->info(sprintf('完了: 更新成功 %d / 失効処理 %d / 失敗 %d', $ok, $expiredOk, $ng));
        return self::SUCCESS;
    }
}
