<?php

namespace App\Services\Admin;

use App\Models\ActivityEvent;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\Subscription;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\WonItem;
use App\Services\InvoiceTaxResolver;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * 管理者向けCSVエクスポート
 *
 * 集計方針:
 * - 「落札金額/手数料/送料」は won_items の合算（落札確定全件、支払い状況は問わない）
 * - 消費税は3区分（落札者 / インボイス有出品者 / インボイス無出品者）。
 *   帳票（請求書・支払通知書）と同じ単位で floor 丸めしてから合算し、帳票合計と一致させる
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
                '入札者数',
                '会場参加者数',
                '落札金額(税抜)',
                '落札者手数料(税抜)',
                '出品者手数料(税抜)',
                '送料(税抜)',
                '消費税(落札者)',
                '消費税(インボイス有出品者)',
                '消費税(インボイス無出品者)',
                '落札者請求合計(税込)',
                '出品者支払合計(税込)',
                // 行動分析（activity_events / is_test ユーザー除外）
                '閲覧数',
                '閲覧UU',
                'お気に入り数',
                '指値数',
            ]);

            $auctions = $auctionsQuery->get();
            $auctionIds = $auctions->pluck('id')->all();
            $stats = $this->aggregateAuctionStats($auctionIds);
            $taxStats = $this->aggregateAuctionTaxStats($auctions, $taxRate);
            $activity = $this->aggregateAuctionActivityStats($auctionIds);

            foreach ($auctions as $auction) {
                $s = $stats[$auction->id] ?? $this->emptyStats();
                $t = $taxStats[$auction->id] ?? $this->emptyTaxStats();
                $a = $activity[$auction->id] ?? $this->emptyActivityStats();

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
                    // 入札者数 = bid_participants の distinct user（従来の「参加数」。is_test 含む）
                    $s['participants_count'],
                    // 会場参加者数 = 会場ボタン(venue_enter)のユニークユーザー数（is_test 除外）
                    $a['venue_enter'],
                    (int) $s['sales'],
                    (int) $s['commission'],
                    // 出品者手数料 = 支払通知書で出品者から控除する額。現状は落札者と同率(10%)・同額
                    (int) $s['commission'],
                    (int) $s['shipping'],
                    $t['buyer_tax'],
                    $t['seller_tax_registered'],
                    $t['seller_tax_exempt'],
                    $t['buyer_total'],
                    $t['seller_payout_total'],
                    $a['views'],
                    $a['view_users'],
                    $a['favorites'],
                    $a['bid_limits'],
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
                'sellerProfile:id,user_id,business_registration_number',
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

        $activity = $this->aggregateItemActivityStats($auctionId, $from, $to, $includeTest);

        return response()->stream(function () use ($query, $taxRate, $activity) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF) . chr(0xBB) . chr(0xBF));

            fputcsv($out, [
                'オークションID',
                'オークション日',
                'オークション名',
                '出品番号',
                '出品ID',
                '品種名',
                '匹数',
                '出品者名',
                '出品者ID',
                'ステータス',
                '落札者名',
                '落札者ID',
                '落札金額(税抜)',
                '落札者手数料(税抜)',
                '出品者手数料(税抜)',
                '送料(税抜)',
                '消費税(落札者)',
                '消費税(インボイス有出品者)',
                '消費税(インボイス無出品者)',
                '落札者請求合計(税込)',
                '出品者支払合計(税込)',
                // 行動分析（activity_events / is_test ユーザー除外）
                '閲覧数',
                '閲覧UU',
                'お気に入り数',
                '指値数',
            ]);

            $resolver = app(InvoiceTaxResolver::class);
            // resolve() は SystemSetting を読むため、オークション×登録番号単位でメモ化
            $taxMetaCache = [];

            foreach ($query->lazy(200) as $item) {
                $auction = $item->auction;
                $sellerName = $this->resolveSellerName($item);
                $sellerId = $item->sellerProfile?->user?->id;
                $won = $item->wonItem;
                $act = $activity[$item->id] ?? $this->emptyActivityStats();

                // 金額列は落札済みの行のみ。未落札は全て空欄
                $sales = $commission = $shipping = $buyerTax = $buyerTotal = '';
                $sellerTaxRegistered = $sellerTaxExempt = $sellerPayout = '';
                $winnerName = '';
                $winnerId = null;

                if ($won) {
                    // 落札金額(税抜) = 落札価格 × 匹数。total_amount は手数料込みのため使わない。
                    $sales = (int) ((float) $won->winning_price * (int) $won->quantity);
                    $shipping = (int) (float) $won->shipping_fee;
                    // 落札者手数料・出品者手数料はいずれも won_items.commission_amount
                    // （サマリーCSVと同じ扱い。現状は同率10%・同額）
                    $commission = (int) (float) $won->commission_amount;

                    // 落札者側: 請求書と同式（落札+手数料+送料の税込）。生体単位で floor 丸めするため、
                    // 帳票単位（落札者×オークション）で丸めるサマリーCSVとは合計が一致しない場合がある
                    $buyerTax = (int) floor(($sales + $commission + $shipping) * $taxRate / 100);
                    $buyerTotal = $sales + $commission + $shipping + $buyerTax;

                    // 出品者側: 支払通知書と同じ税率解決（インボイス有無・経過措置は event_date 基準）。
                    // 消費税はインボイス有/無の該当区分のみに出力する
                    if ($auction && $item->sellerProfile) {
                        $cacheKey = $auction->id . ':' . ($item->sellerProfile->business_registration_number ?? '');
                        $taxMeta = $taxMetaCache[$cacheKey] ??= $resolver->resolve($auction, $item->sellerProfile);

                        $taxWinning = (int) floor($sales * $taxMeta['winning_tax_rate'] / 100);
                        $taxCommission = (int) floor($commission * $taxMeta['commission_tax_rate'] / 100);
                        $sellerTax = $taxWinning - $taxCommission;

                        if ($taxMeta['is_tax_exempt']) {
                            $sellerTaxExempt = $sellerTax;
                        } else {
                            $sellerTaxRegistered = $sellerTax;
                        }
                        $sellerPayout = ($sales + $taxWinning) - ($commission + $taxCommission);
                    }

                    $winnerName = $this->resolveWinnerName($won);
                    $winnerId = $won->winner_id;
                }

                fputcsv($out, [
                    $auction?->id ?? '',
                    optional($auction?->event_date)->format('Y-m-d') ?? '',
                    $auction?->title ?? '',
                    $item->item_number,
                    // 出品ID = レーン割当時に発行される表示用ID（お気に入り/指値CSVと同じ表記）
                    $item->exhibit_code ?: '未発行',
                    $item->species_name,
                    $item->quantity,
                    $sellerName,
                    $sellerId ?? '',
                    $item->status,
                    $winnerName,
                    $winnerId ?? '',
                    $sales,
                    $commission,
                    $commission,
                    $shipping,
                    $buyerTax,
                    $sellerTaxRegistered,
                    $sellerTaxExempt,
                    $buyerTotal,
                    $sellerPayout,
                    $act['views'],
                    $act['view_users'],
                    $act['favorites'],
                    $act['bid_limits'],
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
                    $regLabel = '会員登録済';
                } elseif ($registered) {
                    $regLabel = '口座(振込/確認)待ち';
                } else {
                    $regLabel = '申請済/決済待ち';
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
     * 列: お届け先会社・部門名1 / お届け先名 / 箱サイズ(袋構成) / 出品ID /
     *     お届け先郵便番号 / お届け先住所 / お届け先住所（建物名） / お届け先電話番号
     *   - 「お届け先会社・部門名1」は users.trade_name（屋号）、空なら氏名で代用（同シートでグループ化しやすくする）
     *   - 箱列は shipping_breakdown.boxes を「100(S×1/M×1)・100(M×2)」形式に整形
     *   - 対面引取 (delivery_method=pickup) は箱列を空欄
     *   - 出品IDは「A001(サファイヤ)・A002(サファイヤ)」形式（出品ID=items.exhibit_code、品種名=items.species_name）。未発行なら items.id にフォールバック
     *   - お届け先住所は users.prefecture + city + address_line1 を連結、建物名は address_line2
     *   - 弊社発送モデルのため、お届け先＝落札者(winner)の登録住所
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

            fputcsv($out, [
                'お届け先会社・部門名1',
                'お届け先名',
                '箱サイズ(袋構成)',
                '出品ID',
                'お届け先郵便番号',
                'お届け先住所',
                'お届け先住所（建物名）',
                'お届け先電話番号',
            ]);

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
                    ->with(['item:id,exhibit_code,species_name'])
                    ->orderBy('item_id')
                    ->get();

                if ($wonItems->isEmpty()) continue;

                $name = (string) ($winner->name ?? '');
                $tradeName = $winner->trade_name !== null && $winner->trade_name !== ''
                    ? $winner->trade_name
                    : $name;

                // お届け先住所 = 都道府県 + 市区町村 + 住所1 を連結（建物名は別列）
                $address = implode('', array_filter([
                    (string) ($winner->prefecture ?? ''),
                    (string) ($winner->city ?? ''),
                    (string) ($winner->address_line1 ?? ''),
                ], fn ($s) => $s !== ''));

                fputcsv($out, [
                    $tradeName,
                    $name,
                    $this->formatBoxesForShippingCsv($wonItems),
                    $this->formatItemIdsForShippingCsv($wonItems),
                    (string) ($winner->postal_code ?? ''),
                    $address,
                    (string) ($winner->address_line2 ?? ''),
                    (string) ($winner->phone ?? ''),
                ]);
            }

            fclose($out);
        }, 200, $headers);
    }

    /**
     * 5つ目: お気に入り登録一覧CSV（オークション1件、開催前の事前確認用）
     *
     * 1行 = 1お気に入り。対象オークションに紐づく出品(items.auction_id)への
     * favorites を、会員ごと・登録日時降順で出力する。
     */
    public function streamFavorites(int $auctionId): StreamedResponse
    {
        Auction::findOrFail($auctionId);
        $filename = sprintf('auction_%d_favorites.csv', $auctionId);

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ];

        $query = DB::table('favorites as f')
            ->join('users as u', 'u.id', '=', 'f.user_id')
            ->join('items as i', 'i.id', '=', 'f.item_id')
            ->join('seller_profiles as sp', 'sp.id', '=', 'i.seller_profile_id')
            ->join('users as su', 'su.id', '=', 'sp.user_id')
            ->where('i.auction_id', $auctionId)
            ->orderBy('u.id')
            ->orderByDesc('f.created_at')
            ->select([
                'u.id as user_id',
                'u.name as user_name',
                'u.trade_name as trade_name',
                'i.id as item_id',
                'i.exhibit_code as exhibit_code',
                'i.species_name as species_name',
                'i.quantity as quantity',
                'su.trade_name as seller_trade_name',
                'f.created_at as favorited_at',
            ]);

        return response()->stream(function () use ($query) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF) . chr(0xBB) . chr(0xBF));

            fputcsv($out, [
                '会員ID',
                '氏名',
                '屋号',
                '出品ID',
                '生体ID',
                '品種名',
                '匹数',
                '出品者(屋号)',
                'お気に入り登録日時',
            ]);

            foreach ($query->lazy(200) as $row) {
                fputcsv($out, [
                    $row->user_id,
                    $row->user_name ?? '',
                    $row->trade_name ?? '-',
                    $row->exhibit_code ?? '未発行',
                    $row->item_id,
                    $row->species_name ?? '',
                    $row->quantity,
                    $row->seller_trade_name ?? '-',
                    $row->favorited_at ? Carbon::parse($row->favorited_at)->format('Y-m-d H:i:s') : '',
                ]);
            }

            fclose($out);
        }, 200, $headers);
    }

    /**
     * 6つ目: 指値設定一覧CSV（オークション1件、開催前の事前確認用）
     *
     * 1行 = 1指値。対象オークションに紐づく出品(items.auction_id)への
     * bid_limit_prices を、会員ごと・設定日時降順で出力する。
     */
    public function streamBidLimits(int $auctionId): StreamedResponse
    {
        Auction::findOrFail($auctionId);
        $filename = sprintf('auction_%d_bid_limits.csv', $auctionId);

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ];

        $query = DB::table('bid_limit_prices as blp')
            ->join('users as u', 'u.id', '=', 'blp.user_id')
            ->join('items as i', 'i.id', '=', 'blp.item_id')
            ->join('seller_profiles as sp', 'sp.id', '=', 'i.seller_profile_id')
            ->join('users as su', 'su.id', '=', 'sp.user_id')
            ->where('i.auction_id', $auctionId)
            ->orderBy('u.id')
            ->orderByDesc('blp.created_at')
            ->select([
                'u.id as user_id',
                'u.name as user_name',
                'u.trade_name as trade_name',
                'i.id as item_id',
                'i.exhibit_code as exhibit_code',
                'i.species_name as species_name',
                'i.quantity as quantity',
                'su.trade_name as seller_trade_name',
                'blp.limit_price as limit_price',
                'blp.is_triggered as is_triggered',
                'blp.triggered_at as triggered_at',
                'blp.created_at as limit_set_at',
            ]);

        return response()->stream(function () use ($query) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF) . chr(0xBB) . chr(0xBF));

            fputcsv($out, [
                '会員ID',
                '氏名',
                '屋号',
                '出品ID',
                '生体ID',
                '品種名',
                '匹数',
                '出品者(屋号)',
                '指値金額',
                '発動済み',
                '発動日時',
                '指値設定日時',
            ]);

            foreach ($query->lazy(200) as $row) {
                fputcsv($out, [
                    $row->user_id,
                    $row->user_name ?? '',
                    $row->trade_name ?? '-',
                    $row->exhibit_code ?? '未発行',
                    $row->item_id,
                    $row->species_name ?? '',
                    $row->quantity,
                    $row->seller_trade_name ?? '-',
                    (int) $row->limit_price,
                    $row->is_triggered ? '発動済' : '未発動',
                    $row->triggered_at ? Carbon::parse($row->triggered_at)->format('Y-m-d H:i:s') : '',
                    $row->limit_set_at ? Carbon::parse($row->limit_set_at)->format('Y-m-d H:i:s') : '',
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
     * 出品IDを「出品ID(品種名)」形式で「・」連結。
     * 出品IDは items.exhibit_code（レーン割当時に発行される表示専用ID。例: A001）。
     * 未発行（null/空）の場合のみ items.id にフォールバックし、発送現場で識別子が欠落しないようにする。
     * 品種名は items.species_name（出品時に入力された個別品種名）。
     * 例: "A001(サファイヤ)・A002(サファイヤ)・A003(オロチ)"
     */
    private function formatItemIdsForShippingCsv($wonItems): string
    {
        return $wonItems->map(function ($w) {
            $item = $w->item;
            if (!$item) return '';
            $code = $item->exhibit_code !== null && $item->exhibit_code !== ''
                ? (string) $item->exhibit_code
                : (string) $item->id;
            $species = $item->species_name;
            return $species !== null && $species !== ''
                ? "{$code}({$species})"
                : $code;
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

        // bid_participants ベースの入札者数（入札参加した distinct user）
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
     * オークション別の行動指標（activity_events）を1クエリで集計する。
     *
     * - 閲覧数/閲覧UU … item_view の件数と distinct ユーザー数
     * - 会場参加者数   … venue_enter（会場ボタン）のユニークユーザー数
     * - お気に入り数   … favorite_add の累計発生回数（解除しても減らない）
     * - 指値数         … bid_limit_set の累計発生回数（同上）
     * 分析ダッシュボードと数値を一致させるため is_test ユーザーは除外する（確定仕様）。
     * item_view は開催前(preparing/scheduled)のみ記録されるため、
     * 終了オークションの閲覧数は「開始前の閲覧」を表す点に注意。
     *
     * @param int[] $auctionIds
     * @return array<int, array{views:int,view_users:int,venue_enter:int,favorites:int,bid_limits:int}>  key=auction_id
     */
    private function aggregateAuctionActivityStats(array $auctionIds): array
    {
        if (empty($auctionIds)) {
            return [];
        }

        $rows = DB::table('activity_events as ae')
            ->join('users as u', 'u.id', '=', 'ae.user_id')
            ->where('u.is_test', false)
            ->whereIn('ae.auction_id', $auctionIds)
            ->whereIn('ae.event_type', [
                ActivityEvent::ITEM_VIEW,
                ActivityEvent::VENUE_ENTER,
                ActivityEvent::FAVORITE_ADD,
                ActivityEvent::BID_LIMIT_SET,
            ])
            ->groupBy('ae.auction_id', 'ae.event_type')
            ->selectRaw('ae.auction_id, ae.event_type, COUNT(*) as cnt, COUNT(DISTINCT ae.user_id) as uu')
            ->get();

        $result = [];
        foreach ($auctionIds as $id) {
            $result[$id] = $this->emptyActivityStats();
        }

        foreach ($rows as $r) {
            $this->applyActivityRow($result[$r->auction_id], $r);
        }

        return $result;
    }

    /**
     * 生体（item）別の行動指標（activity_events）を1クエリで集計する。
     * 出品明細CSVと同じ絞り込み（auction_id / event_date 期間 / is_test オークション）を
     * activity_events→auctions の JOIN で再現し、item_id ごとにまとめる。
     * 集計方針は aggregateAuctionActivityStats と同じ（is_test ユーザー除外）。
     * venue_enter は item_id を持たないため item 単位では常に 0。
     *
     * @return array<int, array{views:int,view_users:int,venue_enter:int,favorites:int,bid_limits:int}>  key=item_id
     */
    private function aggregateItemActivityStats(?int $auctionId, ?Carbon $from, ?Carbon $to, bool $includeTest): array
    {
        $q = DB::table('activity_events as ae')
            ->join('users as u', 'u.id', '=', 'ae.user_id')
            ->join('auctions as a', 'a.id', '=', 'ae.auction_id')
            ->whereNull('a.deleted_at')
            ->where('u.is_test', false)
            ->whereNotNull('ae.item_id')
            ->whereIn('ae.event_type', [
                ActivityEvent::ITEM_VIEW,
                ActivityEvent::FAVORITE_ADD,
                ActivityEvent::BID_LIMIT_SET,
            ]);

        if ($auctionId) {
            $q->where('ae.auction_id', $auctionId);
        }
        if ($from) {
            $q->whereDate('a.event_date', '>=', $from->toDateString());
        }
        if ($to) {
            $q->whereDate('a.event_date', '<=', $to->toDateString());
        }
        if (! $includeTest) {
            $q->where('a.is_test', false);
        }

        $rows = $q->groupBy('ae.item_id', 'ae.event_type')
            ->selectRaw('ae.item_id, ae.event_type, COUNT(*) as cnt, COUNT(DISTINCT ae.user_id) as uu')
            ->get();

        $result = [];
        foreach ($rows as $r) {
            if (! isset($result[$r->item_id])) {
                $result[$r->item_id] = $this->emptyActivityStats();
            }
            $this->applyActivityRow($result[$r->item_id], $r);
        }

        return $result;
    }

    /**
     * 集計行（event_type/cnt/uu）を行動指標の連想配列に反映する。
     */
    private function applyActivityRow(array &$stats, object $row): void
    {
        switch ($row->event_type) {
            case ActivityEvent::ITEM_VIEW:
                $stats['views'] = (int) $row->cnt;
                $stats['view_users'] = (int) $row->uu;
                break;
            case ActivityEvent::VENUE_ENTER:
                // 1ユーザー1オークション1行のため件数=者数。者数として uu を採用
                $stats['venue_enter'] = (int) $row->uu;
                break;
            case ActivityEvent::FAVORITE_ADD:
                $stats['favorites'] = (int) $row->cnt;
                break;
            case ActivityEvent::BID_LIMIT_SET:
                $stats['bid_limits'] = (int) $row->cnt;
                break;
        }
    }

    private function emptyActivityStats(): array
    {
        return [
            'views' => 0,
            'view_users' => 0,
            'venue_enter' => 0,
            'favorites' => 0,
            'bid_limits' => 0,
        ];
    }

    /**
     * 消費税3区分と税込合計をオークション別に集計する。
     *
     * 丸めは帳票と同じ単位で floor してから合算する（帳票合計との一致が目的）:
     * - 落札者分: 請求書と同じ「落札者×オークション」単位で
     *   (落札金額 + 落札者手数料 + 送料) × tax_rate
     * - 出品者分: 支払通知書と同じ「出品者×オークション」単位で
     *   落札金額×税率 − 手数料×tax_rate のネット額。
     *   落札金額の税率は InvoiceTaxResolver（インボイス登録有=10% / 未登録=経過措置率、
     *   基準日は event_date）。手数料は自社の課税売上のため登録有無によらず常に tax_rate
     *
     * @param \Illuminate\Support\Collection<int, Auction> $auctions
     * @return array<int, array<string, int>>  key=auction_id
     */
    private function aggregateAuctionTaxStats($auctions, float $taxRate): array
    {
        $auctionIds = $auctions->pluck('id')->all();
        if (empty($auctionIds)) {
            return [];
        }

        $result = [];
        foreach ($auctionIds as $id) {
            $result[$id] = $this->emptyTaxStats();
        }

        // 落札者×オークション単位（請求書と同じ丸め）
        $buyerGroups = DB::table('won_items')
            ->join('items', 'items.id', '=', 'won_items.item_id')
            ->whereIn('items.auction_id', $auctionIds)
            ->groupBy('items.auction_id', 'won_items.winner_id')
            ->select(
                'items.auction_id',
                'won_items.winner_id',
                DB::raw('COALESCE(SUM(won_items.winning_price * won_items.quantity), 0) as winning'),
                DB::raw('COALESCE(SUM(won_items.commission_amount), 0) as commission'),
                DB::raw('COALESCE(SUM(won_items.shipping_fee), 0) as shipping'),
            )
            ->get();

        foreach ($buyerGroups as $g) {
            $base = (float) $g->winning + (float) $g->commission + (float) $g->shipping;
            $tax = (int) floor($base * $taxRate / 100);
            $result[$g->auction_id]['buyer_tax'] += $tax;
            $result[$g->auction_id]['buyer_total'] += (int) $base + $tax;
        }

        // 出品者×オークション単位（支払通知書と同じ丸め）
        $resolver = app(InvoiceTaxResolver::class);
        $auctionById = $auctions->keyBy('id');
        $sellerStub = new SellerProfile();

        $sellerGroups = DB::table('won_items')
            ->join('items', 'items.id', '=', 'won_items.item_id')
            ->join('seller_profiles', 'seller_profiles.id', '=', 'items.seller_profile_id')
            ->whereIn('items.auction_id', $auctionIds)
            ->groupBy('items.auction_id', 'items.seller_profile_id', 'seller_profiles.business_registration_number')
            ->select(
                'items.auction_id',
                'items.seller_profile_id',
                'seller_profiles.business_registration_number',
                DB::raw('COALESCE(SUM(won_items.winning_price * won_items.quantity), 0) as winning'),
                DB::raw('COALESCE(SUM(won_items.commission_amount), 0) as commission'),
            )
            ->get();

        foreach ($sellerGroups as $g) {
            $sellerStub->business_registration_number = $g->business_registration_number;
            $taxMeta = $resolver->resolve($auctionById[$g->auction_id], $sellerStub);

            $taxWinning = (int) floor((float) $g->winning * $taxMeta['winning_tax_rate'] / 100);
            $taxCommission = (int) floor((float) $g->commission * $taxMeta['commission_tax_rate'] / 100);

            $key = $taxMeta['is_tax_exempt'] ? 'seller_tax_exempt' : 'seller_tax_registered';
            $result[$g->auction_id][$key] += $taxWinning - $taxCommission;
            $result[$g->auction_id]['seller_payout_total'] +=
                ((int) $g->winning + $taxWinning) - ((int) $g->commission + $taxCommission);
        }

        return $result;
    }

    private function emptyTaxStats(): array
    {
        return [
            'buyer_tax' => 0,
            'buyer_total' => 0,
            'seller_tax_registered' => 0,
            'seller_tax_exempt' => 0,
            'seller_payout_total' => 0,
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
