<?php

namespace App\Services\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Subscription;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * 管理者向けCSVエクスポート
 *
 * 集計方針:
 * - 「売上/手数料/送料」は won_items の合算（落札確定全件、支払い状況は問わない）
 * - 「税金」は (売上 + 手数料 + 送料) × SystemSetting('tax_rate', 10) / 100
 * - 「会員数」のみ全体スナップショット（実行時点の有効会員数）。他の人数はオークション単位のユニーク数
 * - is_test=true のオークションはデフォルトで除外（クエリ ?include_test=1 で含める）
 */
class CsvExportService
{
    /**
     * 1つ目: オークション一覧サマリーCSV
     * 期間で絞り込み、1行=1オークション
     */
    public function streamAuctionSummary(?Carbon $from, ?Carbon $to, bool $includeTest = false): StreamedResponse
    {
        $taxRate = (float) SystemSetting::get('tax_rate', 10);
        $memberCount = (int) User::query()->count(); // 全体スナップショット

        $auctionsQuery = Auction::query()
            ->orderBy('event_date')
            ->orderBy('id');

        if ($from) {
            $auctionsQuery->whereDate('event_date', '>=', $from->toDateString());
        }
        if ($to) {
            $auctionsQuery->whereDate('event_date', '<=', $to->toDateString());
        }
        if (! $includeTest) {
            $auctionsQuery->where('is_test', false);
        }

        $filename = sprintf(
            'auction_summary_%s_%s.csv',
            $from?->format('Ymd') ?? 'all',
            $to?->format('Ymd') ?? 'all'
        );

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ];

        return response()->stream(function () use ($auctionsQuery, $taxRate, $memberCount) {
            $out = fopen('php://output', 'w');
            // Excel 用 BOM
            fprintf($out, chr(0xEF) . chr(0xBB) . chr(0xBF));

            fputcsv($out, [
                'オークションID',
                'オークション名',
                'オークション日',
                'ステータス',
                '会員数',
                '出品数',
                '出品人数',
                '落札数',
                '落札人数',
                '参加数',
                '売上(税抜)',
                '手数料(税抜)',
                '送料(税抜)',
                '税金',
                '合計(税込)',
            ]);

            $auctions = $auctionsQuery->get();
            $stats = $this->aggregateAuctionStats($auctions->pluck('id')->all());

            foreach ($auctions as $auction) {
                $s = $stats[$auction->id] ?? $this->emptyStats();

                $sales = (float) $s['sales'];
                $commission = (float) $s['commission'];
                $shipping = (float) $s['shipping'];
                $tax = floor(($sales + $commission + $shipping) * $taxRate / 100);
                $grand = $sales + $commission + $shipping + $tax;

                fputcsv($out, [
                    $auction->id,
                    $auction->title,
                    optional($auction->event_date)->format('Y-m-d') ?? '',
                    $auction->status,
                    $memberCount,
                    $s['items_count'],
                    $s['sellers_count'],
                    $s['won_count'],
                    $s['winners_count'],
                    $s['participants_count'],
                    (int) $sales,
                    (int) $commission,
                    (int) $shipping,
                    (int) $tax,
                    (int) $grand,
                ]);
            }

            fclose($out);
        }, 200, $headers);
    }

    /**
     * 2つ目: 出品生体軸CSV（全出品・未落札含む）
     * 期間 or auction_id で絞り込み可能
     */
    public function streamAuctionItems(?int $auctionId, ?Carbon $from, ?Carbon $to, bool $includeTest = false): StreamedResponse
    {
        $taxRate = (float) SystemSetting::get('tax_rate', 10);

        $query = Item::query()
            ->with([
                'auction:id,title,event_date,is_test',
                'sellerProfile:id,user_id',
                'sellerProfile.user:id,name,trade_name',
                'wonItem.winner:id,name,trade_name',
            ])
            ->join('auctions', 'auctions.id', '=', 'items.auction_id')
            ->whereNull('auctions.deleted_at')
            ->select('items.*')
            ->orderBy('auctions.event_date')
            ->orderBy('items.auction_id')
            ->orderBy('items.item_number');

        if ($auctionId) {
            $query->where('items.auction_id', $auctionId);
        }
        if ($from) {
            $query->whereDate('auctions.event_date', '>=', $from->toDateString());
        }
        if ($to) {
            $query->whereDate('auctions.event_date', '<=', $to->toDateString());
        }
        if (! $includeTest) {
            $query->where('auctions.is_test', false);
        }

        $filename = $auctionId
            ? sprintf('auction_%d_items.csv', $auctionId)
            : sprintf('auction_items_%s_%s.csv', $from?->format('Ymd') ?? 'all', $to?->format('Ymd') ?? 'all');

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ];

        return response()->stream(function () use ($query, $taxRate) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF) . chr(0xBB) . chr(0xBF));

            fputcsv($out, [
                'オークションID',
                'オークション日',
                'オークション名',
                '出品番号',
                '品種名',
                '匹数',
                '出品者名',
                'ステータス',
                '落札者名',
                '落札金額(税抜)',
                '送料(税抜)',
                '手数料(税抜)',
                '税金',
                '合計(税込)',
            ]);

            foreach ($query->lazy(200) as $item) {
                $auction = $item->auction;
                $sellerName = $this->resolveSellerName($item);
                $won = $item->wonItem;

                if ($won) {
                    $sales = (float) $won->total_amount;
                    $shipping = (float) $won->shipping_fee;
                    $commission = (float) $won->commission_amount;
                    $tax = floor(($sales + $commission + $shipping) * $taxRate / 100);
                    $grand = $sales + $commission + $shipping + $tax;
                    $winnerName = $this->resolveWinnerName($won);
                } else {
                    $sales = $shipping = $commission = $tax = $grand = null;
                    $winnerName = '';
                }

                fputcsv($out, [
                    $auction?->id ?? '',
                    optional($auction?->event_date)->format('Y-m-d') ?? '',
                    $auction?->title ?? '',
                    $item->item_number,
                    $item->species_name,
                    $item->quantity,
                    $sellerName,
                    $item->status,
                    $winnerName,
                    $sales !== null ? (int) $sales : '',
                    $shipping !== null ? (int) $shipping : '',
                    $commission !== null ? (int) $commission : '',
                    $tax !== null ? (int) $tax : '',
                    $grand !== null ? (int) $grand : '',
                ]);
            }

            fclose($out);
        }, 200, $headers);
    }

    /**
     * 3つ目: 会員情報CSV
     * 全ユーザー (soft deleted 除外) を 1 行ずつ出力
     */
    public function streamMembers(): StreamedResponse
    {
        $filename = sprintf('members_%s.csv', now()->format('Ymd_His'));

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ];

        return response()->stream(function () {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF) . chr(0xBB) . chr(0xBF));

            fputcsv($out, [
                'ID',
                '氏名',
                '屋号',
                'メールアドレス',
                '郵便番号',
                '都道府県',
                '市区町村',
                '住所1',
                '住所2',
                '電話番号',
                'ロール',
                'ステータス',
                '登録日',
            ]);

            $query = User::query()
                ->with(['roles:id,display_name'])
                ->orderBy('id');

            foreach ($query->lazy(200) as $user) {
                $roles = $user->roles->pluck('display_name')->filter()->implode(' / ');

                fputcsv($out, [
                    $user->id,
                    $user->name ?? '',
                    $user->trade_name ?? '',
                    $user->email ?? '',
                    $user->postal_code ?? '',
                    $user->prefecture ?? '',
                    $user->city ?? '',
                    $user->address_line1 ?? '',
                    $user->address_line2 ?? '',
                    $user->phone ?? '',
                    $roles !== '' ? $roles : '-',
                    $user->status ?? '',
                    optional($user->created_at)->format('Y-m-d') ?? '',
                ]);
            }

            fclose($out);
        }, 200, $headers);
    }

    /**
     * 4つ目: 年会費CSV
     * 全ユーザー1行。subscription の有無 + 最終支払日 (payments.paid_at の MAX) を出す
     */
    public function streamSubscriptions(): StreamedResponse
    {
        $filename = sprintf('subscriptions_%s.csv', now()->format('Ymd_His'));

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ];

        // 最終支払日 (completed のもののみ) を user_id ごとに 1 回で取得
        $lastPaidAt = DB::table('payments')
            ->select('user_id', DB::raw('MAX(paid_at) as last_paid_at'))
            ->where('status', 'completed')
            ->whereNotNull('paid_at')
            ->groupBy('user_id')
            ->pluck('last_paid_at', 'user_id');

        return response()->stream(function () use ($lastPaidAt) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF) . chr(0xBB) . chr(0xBF));

            fputcsv($out, [
                'ID',
                '氏名',
                '屋号',
                'メールアドレス',
                '登録状況',
                'プラン名',
                '年会費(円)',
                'サブスク状態',
                '現在の課金期間終了',
                '最終支払日',
            ]);

            $query = User::query()
                ->with(['subscription.plan'])
                ->orderBy('id');

            foreach ($query->lazy(200) as $user) {
                /** @var \App\Models\Subscription|null $sub */
                $sub = $user->subscription;
                $plan = $sub?->plan;

                $registered = $sub !== null;
                $isActive = $sub !== null && $sub->status === Subscription::STATUS_ACTIVE;

                if ($isActive) {
                    $regLabel = '登録済（有効）';
                } elseif ($registered) {
                    $regLabel = '登録済（' . $sub->status . '）';
                } else {
                    $regLabel = '未登録';
                }

                $lastPaid = $lastPaidAt->get($user->id);
                $lastPaidFormatted = $lastPaid ? Carbon::parse($lastPaid)->format('Y-m-d') : '';

                fputcsv($out, [
                    $user->id,
                    $user->name ?? '',
                    $user->trade_name ?? '',
                    $user->email ?? '',
                    $regLabel,
                    $plan?->name ?? '',
                    $plan?->amount !== null ? (int) $plan->amount : '',
                    $sub?->status ?? '',
                    optional($sub?->current_period_end)->format('Y-m-d') ?? '',
                    $lastPaidFormatted,
                ]);
            }

            fclose($out);
        }, 200, $headers);
    }

    /**
     * オークションIDリストに対する集計を1回のクエリで取得
     *
     * @param int[] $auctionIds
     * @return array<int, array<string, int|float>>  key=auction_id
     */
    private function aggregateAuctionStats(array $auctionIds): array
    {
        if (empty($auctionIds)) {
            return [];
        }

        // items 集計（出品数 / 出品人数 / 落札数 / 落札人数 / 売上 / 手数料 / 送料）
        $itemStats = DB::table('items')
            ->leftJoin('won_items', 'won_items.item_id', '=', 'items.id')
            ->whereIn('items.auction_id', $auctionIds)
            ->groupBy('items.auction_id')
            ->select(
                'items.auction_id',
                DB::raw('COUNT(DISTINCT items.id) as items_count'),
                DB::raw('COUNT(DISTINCT items.seller_profile_id) as sellers_count'),
                DB::raw('COUNT(DISTINCT won_items.id) as won_count'),
                DB::raw('COUNT(DISTINCT won_items.winner_id) as winners_count'),
                DB::raw('COALESCE(SUM(won_items.total_amount), 0) as sales'),
                DB::raw('COALESCE(SUM(won_items.commission_amount), 0) as commission'),
                DB::raw('COALESCE(SUM(won_items.shipping_fee), 0) as shipping'),
            )
            ->get()
            ->keyBy('auction_id');

        // bid_participants ベースの参加数（入札参加した distinct user）
        $participantStats = DB::table('bid_participants')
            ->join('items', 'items.id', '=', 'bid_participants.item_id')
            ->whereIn('items.auction_id', $auctionIds)
            ->groupBy('items.auction_id')
            ->select(
                'items.auction_id',
                DB::raw('COUNT(DISTINCT bid_participants.user_id) as participants_count'),
            )
            ->get()
            ->keyBy('auction_id');

        $result = [];
        foreach ($auctionIds as $id) {
            $i = $itemStats->get($id);
            $p = $participantStats->get($id);

            $result[$id] = [
                'items_count' => (int) ($i->items_count ?? 0),
                'sellers_count' => (int) ($i->sellers_count ?? 0),
                'won_count' => (int) ($i->won_count ?? 0),
                'winners_count' => (int) ($i->winners_count ?? 0),
                'participants_count' => (int) ($p->participants_count ?? 0),
                'sales' => (float) ($i->sales ?? 0),
                'commission' => (float) ($i->commission ?? 0),
                'shipping' => (float) ($i->shipping ?? 0),
            ];
        }

        return $result;
    }

    private function emptyStats(): array
    {
        return [
            'items_count' => 0,
            'sellers_count' => 0,
            'won_count' => 0,
            'winners_count' => 0,
            'participants_count' => 0,
            'sales' => 0.0,
            'commission' => 0.0,
            'shipping' => 0.0,
        ];
    }

    private function resolveSellerName(Item $item): string
    {
        $user = $item->sellerProfile?->user;
        if (! $user) {
            return '-';
        }
        return $user->trade_name ?: ($user->name ?: '-');
    }

    private function resolveWinnerName($wonItem): string
    {
        $user = $wonItem->winner;
        if (! $user) {
            return '-';
        }
        return $user->trade_name ?: ($user->name ?: '-');
    }
}
