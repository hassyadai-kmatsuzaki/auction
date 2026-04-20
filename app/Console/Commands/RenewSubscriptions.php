<?php

namespace App\Console\Commands;

use App\Models\Subscription;
use App\Services\Payment\SubscriptionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class RenewSubscriptions extends Command
{
    protected $signature = 'subscriptions:renew {--dry-run : 実際には課金せず対象を表示}';
    protected $description = '年会費サブスクリプションの期限切れを検知して再課金する';

    public function handle(SubscriptionService $service): int
    {
        $due = Subscription::dueForRenewal()->with('plan', 'user')->get();

        $this->info(sprintf('更新対象: %d 件', $due->count()));

        if ($this->option('dry-run')) {
            foreach ($due as $s) {
                $this->line(sprintf(' - user=%d  plan=%s  current_period_end=%s', $s->user_id, $s->plan->code ?? '-', $s->current_period_end));
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

        $this->info(sprintf('完了: 成功 %d / 失敗 %d', $ok, $ng));
        return self::SUCCESS;
    }
}
