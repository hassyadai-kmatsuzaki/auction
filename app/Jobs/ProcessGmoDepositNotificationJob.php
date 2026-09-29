<?php

namespace App\Jobs;

use App\Models\GmoDepositNotification;
use App\Services\GmoAozora\GmoDepositReconciliationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * GMOあおぞら 入金明細通知の本処理（落札の入金消込）。
 *
 * ⚠ ライブオークション非影響のため notify キューで実行する（countdown キュー厳禁）。
 *   Controller は既に 200 を返しており、本処理はここで非同期に走る。
 */
class ProcessGmoDepositNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(public int $notificationId)
    {
        $this->onQueue('notify');
    }

    public function handle(GmoDepositReconciliationService $reconciliation): void
    {
        $notification = GmoDepositNotification::find($this->notificationId);
        if (!$notification) {
            return;
        }
        // received 以外（処理済み・手動確認済み）は Service 側で何もしない（冪等）
        $reconciliation->process($notification);
    }
}
