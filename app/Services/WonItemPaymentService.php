<?php

namespace App\Services;

use App\Models\WonItem;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * 落札品の入金確認（同一オークション × 同一落札者の全 WonItem にまとめて適用）。
 *
 * 管理画面の「入金確認」ボタン（Admin/WonItemController::confirmPayment）と
 * GMOあおぞらの自動消込（GmoDepositReconciliationService）の両方から呼ぶ共通処理。
 * 挙動は従来のコントローラ実装と同一で、加えて payment_method / paid_at を記録できるようにした。
 */
class WonItemPaymentService
{
    public function __construct(private readonly NotificationService $notificationService)
    {
    }

    /**
     * 同一 (auction, winner) に属する WonItem を取得する。
     *
     * @return Collection<int, WonItem>
     */
    public function findGroupItems(WonItem $wonItem): Collection
    {
        return WonItem::with('item')
            ->where('winner_id', $wonItem->winner_id)
            ->whereHas('item', fn ($q) => $q->where('auction_id', $wonItem->item->auction_id))
            ->get();
    }

    /**
     * 代表 WonItem のグループ（同一オークション × 同一落札者）を入金確認済みにする。
     *
     * @param  string|null  $paymentMethod  bank_transfer / credit_card / cash / onsite。null なら変更しない
     * @param  CarbonInterface|null  $paidAt  入金日（銀行取引日など）。null なら変更しない
     * @param  string  $source  監査ログ用（admin / gmo_aozora）
     * @return array{affected_count:int, payment_confirmed_at:CarbonInterface, won_item_ids:array<int,int>}|null
     *         対象が無い場合は null
     */
    public function confirmGroup(
        WonItem $representative,
        ?string $paymentMethod = null,
        ?CarbonInterface $paidAt = null,
        string $source = 'admin',
        bool $notify = true,
    ): ?array {
        $representative->loadMissing('item');
        $group = $this->findGroupItems($representative);

        $targets = $group->whereIn('payment_status', ['pending', 'paid']);
        if ($targets->isEmpty()) {
            return null;
        }

        $now = now();
        $ids = $targets->pluck('id');

        $update = [
            'payment_status'       => 'confirmed',
            'payment_confirmed_at' => $now,
        ];
        if ($paymentMethod !== null) {
            $update['payment_method'] = $paymentMethod;
        }
        if ($paidAt !== null) {
            $update['paid_at'] = $paidAt;
        }
        WonItem::whereIn('id', $ids)->update($update);

        WonItem::whereIn('id', $ids)
            ->whereNull('shipping_locked_at')
            ->update(['shipping_locked_at' => $now]);

        // 発送先行で既に shipped/completed の場合は巻き戻さない
        WonItem::whereIn('id', $ids)
            ->where('delivery_status', 'pending')
            ->update(['delivery_status' => 'preparing']);

        Log::channel('audit')->info('WON_ITEM_PAYMENT_CONFIRMED', [
            'source'       => $source,
            'winner_id'    => $representative->winner_id,
            'auction_id'   => $representative->item?->auction_id,
            'won_item_ids' => $ids->all(),
            'payment_method' => $paymentMethod,
            'paid_at'      => $paidAt?->toIso8601String(),
        ]);

        // 落札者通知は代表1件で1回だけ送る（出品者への入金/発送依頼通知は弊社発送のため送らない）
        if ($notify) {
            $fresh = WonItem::with(['item.seller', 'user'])->find($representative->id);
            if ($fresh) {
                $this->notificationService->sendPaymentConfirmedNotification($fresh);
            }
        }

        return [
            'affected_count'       => $targets->count(),
            'payment_confirmed_at' => $now,
            'won_item_ids'         => $ids->all(),
        ];
    }
}
