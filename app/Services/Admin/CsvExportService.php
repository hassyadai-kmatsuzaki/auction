<?php

namespace App\Services\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Subscription;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\WonItem;
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
                '出品者ID',
                'ステータス',
                '落札者名',
                '落札者ID',
                '落札金額(税抜)',
                '送料(税抜)',
                '手数料(税抜)',
                '税金',
                '合計(税込)',
            ]);

            foreach ($query->lazy(200) as $item) {
                $auction = $item->auction;
                $sellerName = $this->resolveSellerName($item);
                $sellerId = $item->sellerProfile?->user?->id;
                $won = $item->wonItem;

                if ($won) {
                    // 落札金額(税抜) = 落札価格 × 匹数。total_amount は手数料込みのため使わない。
                    $sales = (float) $won->winning_price * (int) $won->quantity;
                    $shipping = (float) $won->shipping_fee;
                    $commission = (float) $won->commission_amount;
                    $tax = floor(($sales + $commission + $shipping) * $taxRate / 100);
                    $grand = $sales + $commission + $shipping + $tax;
                    $winnerName = $this->resolveWinnerName($won);
                    $winnerId = $won->winner_id;
                } else {
                    $sales = $shipping = $commission = $tax = $grand = null;
                    $winnerName = '';
                    $winnerId = null;
                }

                fputcsv($out, [
                    $auction?->id ?? '',
                    optional($auction?->event_date)->format('Y-m-d') ?? '',
                    $auction?->title ?? '',
                    $item->item_number,
                    $item->species_name,
                    $item->quantity,
                    $sellerName,
                    $sellerId ?? '',
                    $item->status,
                    $winnerName,
                    $winnerId ?? '',
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
     * 3つ目: 会員情報CSV（年会費情報を統合）
     * 全ユーザー (soft deleted 除外) を 1 行ずつ出力
     */
    public function streamMembers(): StreamedResponse
    {
        $filename = sprintf('members_%s.csv', now()->format('Ymd_His'));

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
                '郵便番号',
                '都道府県',
                '市区町村',
                '住所1',
                '住所2',
                '電話番号',
                'ロール',
                'ステータス',
                '登録日',
                '年会費登録状況',
                'プラン名',
                '年会費(円)',
                'サブスク状態',
                '現在の課金期間終了',
                '最終支払日',
                'インボイス番号',
                '銀行名',
                '支店名',
                '種別',
                '口座番号',
                '名義',
            ]);

            $query = User::query()
                ->with([
                    'roles:id,display_name',
                    'subscription.plan',
                    'sellerProfile:id,user_id,business_registration_number,bank_name,bank_branch,account_type,account_number,account_holder',
                ])
                ->orderBy('id');

            foreach ($query->lazy(200) as $user) {
                $roles = $user->roles->pluck('display_name')->filter()->implode(' / ');

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

                $profile = $user->sellerProfile;

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
                    $regLabel,
                    $plan?->name ?? '',
                    $plan?->amount !== null ? (int) $plan->amount : '',
                    $sub?->status ?? '',
                    optional($sub?->current_period_end)->format('Y-m-d') ?? '',
                    $lastPaidFormatted,
                    $profile?->business_registration_number ?? '',
                    $profile?->bank_name ?? '',
                    $profile?->bank_branch ?? '',
                    $this->formatAccountType($profile?->account_type),
                    $profile?->account_number ?? '',
                    $profile?->account_holder ?? '',
                ]);
            }

            fclose($out);
        }, 200, $headers);
    }

    /**
     * 4つ目: 発送作業用 落札者リストCSV（オークション1件、落札者でグルーピング）
     *
     * 1行 = 1落札者。発送現場が「誰に・どの箱を・どの商品を」まとめるための一覧。
     * 列: 屋号 / 名前 / 箱サイズ(袋構成) / 商品ID
     *   - 屋号は users.trade_name、空なら氏名で代用（同シートでグループ化しやすくする）
     *   - 箱列は shipping_breakdown.boxes を「100(S×1/M×1)・100(M×2)」形式に整形
     *   - 対面引取 (delivery_method=pickup) は箱列を空欄
     *   - 商品IDは「1601(サファイヤ)・1602(サファイヤ)」形式（種別名は items.speciesType.name）
     */
    public function streamWonItemsShipping(int $auctionId): StreamedResponse
    {
        $auction = Auction::findOrFail($auctionId);
        $filename = sprintf('auction_%d_shipping_list.csv', $auctionId);

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ];

        return response()->stream(function () use ($auctionId) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF) . chr(0xBB) . chr(0xBF));

            fputcsv($out, ['屋号', '名前', '箱サイズ(袋構成)', '商品ID']);

            $winnerIds = WonItem::whereHas('item', fn ($q) => $q->where('auction_id', $auctionId))
                ->whereNotNull('winner_id')
                ->orderBy('winner_id')
                ->pluck('winner_id')
                ->unique()
                ->values();

            foreach ($winnerIds as $winnerId) {
                $winner = User::find($winnerId);
                if (!$winner) continue;

                $wonItems = WonItem::where('winner_id', $winnerId)
                    ->whereHas('item', fn ($q) => $q->where('auction_id', $auctionId))
                    ->with(['item:id,species_name'])
                    ->orderBy('item_id')
                    ->get();

                if ($wonItems->isEmpty()) continue;

                $name = (string) ($winner->name ?? '');
                $tradeName = $winner->trade_name !== null && $winner->trade_name !== ''
                    ? $winner->trade_name
                    : $name;

                fputcsv($out, [
                    $tradeName,
                    $name,
                    $this->formatBoxesForShippingCsv($wonItems),
                    $this->formatItemIdsForShippingCsv($wonItems),
                ]);
            }

            fclose($out);
        }, 200, $headers);
    }

    /**
     * shipping_breakdown.boxes を発送リスト用に整形。
     * boxes[].bags は ShippingCalculatorService::formatBagsInBox() で
     * 既に "S×7" 形式の文字列配列として保存されているため、そのまま並べる。
     * 例: [{box_size:140, bags:["S×7"]}, {box_size:100, bags:["M×2"]}] → "140(S×7)・100(M×2)"
     * 対面引取 (pickup) または breakdown 未設定の場合は空文字。
     */
    private function formatBoxesForShippingCsv($wonItems): string
    {
        $first = $wonItems->first();
        if (!$first) return '';

        if ($first->delivery_method === 'pickup') return '';

        $bd = $first->shipping_breakdown ?? [];
        $boxes = $bd['boxes'] ?? [];
        if (!is_array($boxes) || empty($boxes)) return '';

        $bagOrder = ['S' => 0, 'M' => 1, 'L' => 2, 'KA' => 3];
        $parts = [];
        foreach ($boxes as $box) {
            $size = $box['box_size'] ?? '';
            $bags = $box['bags'] ?? [];
            if (!is_array($bags)) $bags = [];

            $bagsStr = array_values(array_filter(array_map(
                fn ($bag) => (string) $bag,
                $bags
            ), fn ($s) => $s !== ''));

            usort($bagsStr, function ($a, $b) use ($bagOrder) {
                $ka = $bagOrder[explode('×', $a, 2)[0]] ?? 99;
                $kb = $bagOrder[explode('×', $b, 2)[0]] ?? 99;
                return $ka <=> $kb;
            });

            $parts[] = $bagsStr === []
                ? (string) $size
                : "{$size}(" . implode('/', $bagsStr) . ")";
        }
        return implode('・', $parts);
    }

    /**
     * 商品IDを「ID(品種名)」形式で「・」連結。
     * 品種名は items.species_name（出品時に入力された個別品種名）を使う。
     * 例: "1601(サファイヤ)・1602(サファイヤ)・1603(オロチ)"
     */
    private function formatItemIdsForShippingCsv($wonItems): string
    {
        return $wonItems->map(function ($w) {
            $item = $w->item;
            if (!$item) return '';
            $species = $item->species_name;
            return $species !== null && $species !== ''
                ? "{$item->id}({$species})"
                : (string) $item->id;
        })->filter(fn ($s) => $s !== '')->implode('・');
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
                // 売上(税抜) = 落札価格 × 匹数の合算。total_amount は手数料込みのため使わない。
                DB::raw('COALESCE(SUM(won_items.winning_price * won_items.quantity), 0) as sales'),
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

    /**
     * 口座種別コードを日本語表記に変換。空・未知の値はそのまま（空文字）返す。
     */
    private function formatAccountType(?string $type): string
    {
        return match ($type) {
            'savings' => '普通',
            'checking' => '当座',
            default => $type ?? '',
        };
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
