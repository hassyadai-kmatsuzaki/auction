<?php

namespace App\Console\Commands;

use App\Models\Auction;
use App\Models\WonItem;
use App\Services\InvoiceService;
use App\Services\NotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * 入金催促通知を「オークション指定」で手動発火するコマンド。
 *
 * スケジュール実行の SendPaymentReminderJob は全オークション横断で
 * 「期限 24h/1h 以内・payment_status=pending」を拾うため、動作確認目的で
 * 本番で dispatch すると実ユーザーにもメールが飛ぶ（LINE は TestModeService で
 * 絞られるが、メール送信にはそのフィルタが無い）。
 *
 * このコマンドは対象を auction_id で限定し、期限が窓に入っているかを問わず
 * NotificationService::sendPaymentReminderNotification() を直接呼ぶ。
 * 既定はドライランで、--send を付けたときだけ実送信する。
 *
 * 使い方:
 *   # 対象と金額内訳だけ確認（送信しない）
 *   php artisan reminders:payment 85
 *
 *   # 実送信（is_test=false の落札者が含まれる場合は --allow-live が必要）
 *   php artisan reminders:payment 85 --send
 *
 *   # 落札者 / 落札品を絞る
 *   php artisan reminders:payment 85 --winner=821 --send
 *   php artisan reminders:payment 85 --won-item=1234 --won-item=1235 --send
 */
class SendPaymentReminderCommand extends Command
{
    protected $signature = 'reminders:payment
        {auction : オークションID}
        {--send : 実際に送信する（未指定はドライラン）}
        {--winner=* : 落札者ユーザーIDで絞り込む}
        {--won-item=* : won_items.id で絞り込む}
        {--urgency=24時間以内 : メール/LINE 本文に出す期限の文言}
        {--allow-live : is_test=false の落札者を含む送信を許可する}
        {--mark-sent : 送信済みキャッシュを立て、30分ごとのスケジュール送信の追送を止める}';

    protected $description = '指定オークションの未入金落札品に入金催促通知を手動送信する（既定はドライラン）';

    public function handle(NotificationService $notificationService): int
    {
        $auctionId = (int) $this->argument('auction');
        $auction = Auction::find($auctionId);

        if (! $auction) {
            $this->error("auction_id={$auctionId} が見つかりません");

            return self::FAILURE;
        }

        $this->line(sprintf(
            '対象オークション: #%d %s（is_test=%s / status=%s）',
            $auction->id,
            $auction->title ?? '(タイトルなし)',
            $auction->is_test ? 'true' : 'false',
            $auction->status ?? '-',
        ));

        $groups = $this->targetGroups($auctionId);

        if ($groups->isEmpty()) {
            $this->warn('payment_status=pending の落札品が見つかりません（絞り込み条件も確認してください）');

            return self::SUCCESS;
        }

        [$sendable, $skipped] = $this->report($groups);

        foreach ($skipped as $reason) {
            $this->warn($reason);
        }

        if (! $this->option('send')) {
            $this->newLine();
            $this->info('[ドライラン] 送信していません。実送信するには --send を付けてください。');

            return self::SUCCESS;
        }

        if ($sendable->isEmpty()) {
            $this->error('送信可能な対象がありません');

            return self::FAILURE;
        }

        if (! $this->confirmLiveRecipients($sendable)) {
            return self::FAILURE;
        }

        $urgency = (string) $this->option('urgency');
        $sent = 0;

        foreach ($sendable as $group) {
            $notificationService->sendPaymentReminderNotification($group, $urgency);

            if ($this->option('mark-sent')) {
                $this->markSent($group);
            }

            $sent++;
            $this->line(sprintf(
                '  送信: winner_id=%d / won_items=%s',
                $group->first()->winner_id,
                $group->pluck('id')->implode(','),
            ));
        }

        $this->newLine();
        $this->info("{$sent} 通を notify キューに投入しました。ログの『入金催促通知送信』で着信を確認してください。");

        return self::SUCCESS;
    }

    /**
     * 対象の未入金落札品を、スケジュールジョブと同じ「落札者 × 期限」で集約する。
     *
     * @return Collection<string, Collection<int, WonItem>>
     */
    private function targetGroups(int $auctionId): Collection
    {
        $winnerIds = array_filter(array_map('intval', $this->option('winner')));
        $wonItemIds = array_filter(array_map('intval', $this->option('won-item')));

        $wonItems = WonItem::query()
            ->whereHas('item', fn ($q) => $q->where('auction_id', $auctionId))
            ->where('payment_status', 'pending')
            ->when($winnerIds, fn ($q) => $q->whereIn('winner_id', $winnerIds))
            ->when($wonItemIds, fn ($q) => $q->whereIn('id', $wonItemIds))
            ->with(['item', 'winner'])
            ->get();

        return $wonItems
            ->groupBy(fn (WonItem $w) => $w->winner_id.':'.($w->payment_deadline?->getTimestamp() ?? 0))
            ->map(fn (Collection $group) => $group->values());
    }

    /**
     * 集約グループごとに宛先と金額内訳を表示し、送信可能なものだけ返す。
     *
     * sendPaymentReminderNotification() は未承認/停止ユーザーを黙って return するので、
     * ここで同じ条件を先に判定して「送られない対象」を可視化する。
     *
     * @param  Collection<string, Collection<int, WonItem>>  $groups
     * @return array{0: Collection<int, Collection<int, WonItem>>, 1: array<int, string>}
     */
    private function report(Collection $groups): array
    {
        $sendable = collect();
        $skipped = [];

        foreach ($groups as $group) {
            $first = $group->first();
            $user = $first->winner;
            $totals = InvoiceService::buyerTotals($group);

            $this->newLine();
            $this->line(str_repeat('=', 72));
            $this->line(sprintf(
                'winner_id=%s  %s  <%s>',
                $user?->id ?? '-',
                $user?->name ?? '(ユーザー不明)',
                $user?->email ?: '(メールアドレスなし)',
            ));
            $this->line(sprintf(
                '  is_test=%s  status=%s  is_active=%s  入金期限=%s',
                $user?->is_test ? 'true' : 'false',
                $user?->status ?? '-',
                $user?->is_active ? 'true' : 'false',
                $first->payment_deadline?->format('Y/m/d H:i') ?? '未定',
            ));

            $rows = $group->map(fn (WonItem $w) => [
                $w->id,
                mb_strimwidth($w->item?->species_name ?? '-', 0, 28, '…'),
                number_format((int) $w->winning_price).' × '.(int) $w->quantity,
                number_format((int) $w->commission_amount),
                number_format((int) $w->shipping_fee),
                '¥'.number_format(InvoiceService::buyerLineAmount($w)),
                number_format((int) $w->total_amount),
            ])->all();

            $this->table(
                ['won_item', '商品', '落札価格×数量', '手数料', '送料', '明細(税抜)', 'total_amount'],
                $rows,
            );

            $this->line(sprintf(
                '  小計(税抜) ¥%s ／ 手数料 ¥%s ／ 送料 ¥%s ／ 消費税(%s%%) ¥%s',
                number_format($totals['subtotal']),
                number_format($totals['commission_total']),
                number_format($totals['total_shipping_fee']),
                rtrim(rtrim(number_format($totals['tax_rate'], 1), '0'), '.'),
                number_format($totals['tax_amount']),
            ));
            $this->info(sprintf(
                '  通知に出る合計（税込・InvoiceService::buyerTotals）= ¥%s',
                number_format($totals['grand_total']),
            ));
            $this->line(sprintf(
                '  参考: won_items.total_amount の合計（税抜）= ¥%s ← 通知本文がこの額なら税抜のまま',
                number_format($group->sum(fn (WonItem $w) => (int) $w->total_amount)),
            ));

            if (! $user) {
                $skipped[] = "won_items={$group->pluck('id')->implode(',')} は winner が取得できないため送信対象外";

                continue;
            }

            if (! $user->is_active || $user->status !== 'approved') {
                $skipped[] = "winner_id={$user->id} は status={$user->status} / is_active="
                    .($user->is_active ? 'true' : 'false')
                    .' のため通知側で送信が中断されます';

                continue;
            }

            if (! $user->email) {
                $skipped[] = "winner_id={$user->id} はメールアドレス未設定のためメールは送られません（LINE のみ）";
            }

            $sendable->push($group);
        }

        return [$sendable, $skipped];
    }

    /**
     * is_test=false の落札者が混ざっていないかを確認する。
     *
     * 入金催促メールにはテストモードのフィルタが無く、実アドレスへそのまま届くため、
     * --allow-live なしでは実ユーザー宛の送信を止める。
     *
     * @param  Collection<int, Collection<int, WonItem>>  $sendable
     */
    private function confirmLiveRecipients(Collection $sendable): bool
    {
        $live = $sendable
            ->map(fn (Collection $group) => $group->first()->winner)
            ->filter(fn ($user) => ! $user->is_test)
            ->unique('id');

        if ($live->isNotEmpty() && ! $this->option('allow-live')) {
            $this->error(
                'is_test=false の落札者が含まれています: '
                .$live->map(fn ($u) => "#{$u->id} {$u->email}")->implode(', ')
            );
            $this->error('実ユーザーへメールが届きます。意図した送信なら --allow-live を付けて再実行してください。');

            return false;
        }

        return $this->confirm(
            sprintf('%d 通の入金催促通知を送信します。よろしいですか？', $sendable->count()),
            false,
        );
    }

    /**
     * スケジュールジョブの送信済みキャッシュを立てる（24h / 1h の両方）。
     *
     * 期限を過ぎた落札品は TTL が過去になるため書き込まない。
     *
     * @param  Collection<int, WonItem>  $group
     */
    private function markSent(Collection $group): void
    {
        foreach ($group as $wonItem) {
            $deadline = $wonItem->payment_deadline;

            if (! $deadline || $deadline->isPast()) {
                continue;
            }

            foreach (['24h', '1h'] as $bucket) {
                Cache::put("payment_reminder:{$bucket}:{$wonItem->id}", true, $deadline);
            }
        }
    }
}
