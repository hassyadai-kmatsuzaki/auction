<?php

namespace App\Services\GmoAozora;

use App\Models\GmoDepositNotification;
use App\Models\GmoVirtualAccount;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\WonItem;
use App\Services\InvoiceService;
use App\Services\WonItemPaymentService;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * 振込入金口座への入金明細 → 落札の入金消込。
 *
 * 突合ルール:
 *  1. vaId → gmo_virtual_accounts → user_id で落札者を特定（無ければ unmatched）
 *  2. 落札者の未入金グループ（オークション × 落札者、payment_status ∈ {pending, paid}）を列挙
 *  3. 入金額（円）が、いずれか1グループの請求額（InvoiceService::buyerTotals の grand_total = 税込）と
 *     一致すればそのグループ、全グループ合計と一致すれば全グループを消込対象にする
 *  4. gmo_aozora_auto_confirm_payment が ON なら WonItemPaymentService::confirmGroup を実行（= 管理画面の入金確認と同じ）。
 *     OFF なら matched として記録だけ行い、管理者が確認する
 *
 * 金額が一致しない（過不足・複数回に分けた入金）場合は unmatched(amount_mismatch) として残し、
 * 管理者が手動で紐付ける（confirmManually）。
 */
class GmoDepositReconciliationService
{
    public function __construct(
        private readonly GmoVirtualAccountService $virtualAccounts,
        private readonly WonItemPaymentService $payments,
    ) {
    }

    /**
     * Webhook / 同期で受信した通知1件を処理する（冪等: received 以外は何もしない）。
     */
    public function process(GmoDepositNotification $notification): GmoDepositNotification
    {
        return DB::transaction(function () use ($notification) {
            /** @var GmoDepositNotification $locked */
            $locked = GmoDepositNotification::whereKey($notification->id)->lockForUpdate()->first();
            if (!$locked || $locked->status !== GmoDepositNotification::STATUS_RECEIVED) {
                return $locked ?? $notification;
            }

            try {
                $this->reconcile($locked);
            } catch (\Throwable $e) {
                Log::error('GMO deposit reconciliation failed', [
                    'notification_id' => $locked->id,
                    'message_id'      => $locked->message_id,
                    'error'           => $e->getMessage(),
                ]);
                $locked->forceFill([
                    'status'           => GmoDepositNotification::STATUS_ERROR,
                    'processing_error' => mb_substr($e->getMessage(), 0, 1000),
                    'processed_at'     => now(),
                ])->save();
            }

            return $locked;
        });
    }

    private function reconcile(GmoDepositNotification $n): void
    {
        $va = $n->va_id ? $this->virtualAccounts->findByVaId($n->va_id) : null;
        if (!$va) {
            $this->markUnmatched($n, GmoDepositNotification::REASON_NO_VA);
            return;
        }

        $va->forceFill(['last_deposit_at' => $n->transaction_date ?? now()])->save();

        if (!$va->user_id) {
            $this->markUnmatched($n, GmoDepositNotification::REASON_VA_UNASSIGNED);
            return;
        }

        $groups = $this->openGroupsForUser($va->user_id);
        if ($groups->isEmpty()) {
            $this->markUnmatched($n, GmoDepositNotification::REASON_NO_OPEN_ITEMS, $va->user_id);
            return;
        }

        $matched = $this->matchGroups($groups, (int) $n->deposit_amount);
        if ($matched === null) {
            $n->forceFill([
                'expected_amount' => (int) $groups->sum('grand_total'),
            ]);
            $this->markUnmatched($n, GmoDepositNotification::REASON_AMOUNT_MISMATCH, $va->user_id);
            return;
        }

        $wonItemIds = $matched->flatMap(fn ($g) => $g['won_items']->pluck('id'))->values()->all();
        $n->forceFill([
            'status'          => GmoDepositNotification::STATUS_MATCHED,
            'unmatched_reason' => null,
            'matched_user_id' => $va->user_id,
            'won_item_ids'    => $wonItemIds,
            'expected_amount' => (int) $matched->sum('grand_total'),
            'processed_at'    => now(),
        ])->save();

        if (!SystemSetting::get('gmo_aozora_auto_confirm_payment', false)) {
            Log::info('GMO deposit matched (awaiting admin confirmation)', [
                'notification_id' => $n->id, 'user_id' => $va->user_id, 'won_item_ids' => $wonItemIds,
            ]);
            return;
        }

        $this->confirmMatched($n, $matched, null);
    }

    /**
     * matched の通知を won_items に反映する（自動 or 管理者操作）。
     */
    public function confirmMatched(GmoDepositNotification $n, ?Collection $matched = null, ?User $admin = null): void
    {
        if ($matched === null) {
            $ids = $n->won_item_ids ?? [];
            $items = WonItem::with('item')->whereIn('id', $ids)->get();
            $matched = $items->groupBy(fn ($w) => $w->item?->auction_id ?? 0)
                ->map(fn ($g) => ['won_items' => $g, 'grand_total' => InvoiceService::buyerTotals($g)['grand_total']])
                ->values();
        }

        $paidAt = $n->transaction_date ? Carbon::instance($n->transaction_date)->startOfDay() : now();
        foreach ($matched as $group) {
            /** @var WonItem|null $rep */
            $rep = $group['won_items']->first();
            if ($rep) {
                $this->payments->confirmGroup($rep, 'bank_transfer', $paidAt, 'gmo_aozora');
            }
        }

        $n->forceFill([
            'status'       => GmoDepositNotification::STATUS_CONFIRMED,
            'confirmed_at' => now(),
            'confirmed_by' => $admin?->id,
        ])->save();

        Log::channel('audit')->info('GMO_AOZORA_DEPOSIT_CONFIRMED', [
            'notification_id' => $n->id,
            'message_id'      => $n->message_id,
            'user_id'         => $n->matched_user_id,
            'deposit_amount'  => $n->deposit_amount,
            'won_item_ids'    => $n->won_item_ids,
            'by'              => $admin?->id ?? 'auto',
        ]);
    }

    /**
     * 管理者が手動で落札者（代表 WonItem）に紐付けて入金確認する。
     * 金額不一致でも管理者判断で確定できる（差額の扱いは運用側）。
     */
    public function confirmManually(GmoDepositNotification $n, WonItem $representative, User $admin): void
    {
        $representative->loadMissing('item');
        $group = $this->payments->findGroupItems($representative)
            ->whereIn('payment_status', ['pending', 'paid'])->values();
        if ($group->isEmpty()) {
            throw new \InvalidArgumentException('入金確認できる商品がこの落札者にありません。');
        }

        $n->forceFill([
            'matched_user_id' => $representative->winner_id,
            'won_item_ids'    => $group->pluck('id')->all(),
            'expected_amount' => InvoiceService::buyerTotals($group)['grand_total'],
            'unmatched_reason' => null,
            'processed_at'    => $n->processed_at ?? now(),
        ])->save();

        $this->confirmMatched($n, collect([[
            'won_items'   => $group,
            'grand_total' => $n->expected_amount,
        ]]), $admin);

        // 振込入金口座が未割当なら、この落札者に紐付けておく（次回から自動突合できる）
        if ($n->va_id && ($va = $this->virtualAccounts->findByVaId($n->va_id)) && !$va->user_id) {
            $va->forceFill(['user_id' => $representative->winner_id, 'assigned_at' => now()])->save();
        }
    }

    /**
     * 落札者の未入金グループ（オークション単位）と請求額（税込）。
     *
     * @return Collection<int, array{auction_id:int, won_items:Collection<int, WonItem>, grand_total:int}>
     */
    public function openGroupsForUser(int $userId): Collection
    {
        $items = WonItem::with('item')
            ->where('winner_id', $userId)
            ->whereIn('payment_status', ['pending', 'paid'])
            ->get();

        return $items->groupBy(fn ($w) => $w->item?->auction_id ?? 0)
            ->map(fn ($g, $auctionId) => [
                'auction_id'  => (int) $auctionId,
                'won_items'   => $g->values(),
                'grand_total' => (int) InvoiceService::buyerTotals($g)['grand_total'],
            ])
            ->values();
    }

    /**
     * 入金額に一致するグループ集合を返す。1グループ一致 → そのグループ、全体一致 → 全グループ、それ以外 null。
     */
    private function matchGroups(Collection $groups, int $amount): ?Collection
    {
        $single = $groups->first(fn ($g) => $g['grand_total'] === $amount);
        if ($single) {
            return collect([$single]);
        }
        if ($groups->count() > 1 && (int) $groups->sum('grand_total') === $amount) {
            return $groups;
        }
        return null;
    }

    private function markUnmatched(GmoDepositNotification $n, string $reason, ?int $userId = null): void
    {
        $n->forceFill([
            'status'           => GmoDepositNotification::STATUS_UNMATCHED,
            'unmatched_reason' => $reason,
            'matched_user_id'  => $userId,
            'processed_at'     => now(),
        ])->save();

        Log::warning('GMO deposit unmatched', [
            'notification_id' => $n->id,
            'message_id'      => $n->message_id,
            'reason'          => $reason,
            'va_id'           => $n->va_id,
            'deposit_amount'  => $n->deposit_amount,
            'user_id'         => $userId,
        ]);
    }
}
