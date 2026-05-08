<?php

namespace App\Services;

use App\Models\Auction;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use App\Models\SystemSetting;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class InvoiceService
{
    /**
     * オークション×落札者 単位で請求書PDFを生成
     */
    public function generateInvoice(Auction $auction, User $winner): \Barryvdh\DomPDF\PDF
    {
        $wonItems = $this->getWonItems($auction, $winner);
        $data = $this->buildInvoiceData($auction, $winner, $wonItems, 'invoice');

        return Pdf::loadView('pdf.invoice', $data)
            ->setPaper('a4')
            ->setOption('defaultFont', 'ipagothic')
            ->setOption('isRemoteEnabled', true);
    }

    /**
     * オークション×落札者 単位で領収書PDFを生成
     */
    public function generateReceipt(Auction $auction, User $winner): \Barryvdh\DomPDF\PDF
    {
        $wonItems = $this->getWonItems($auction, $winner)
            ->filter(fn ($w) => in_array($w->payment_status, ['paid', 'confirmed']));

        if ($wonItems->isEmpty()) {
            throw new \RuntimeException('入金確認済みの落札品がありません');
        }

        $data = $this->buildInvoiceData($auction, $winner, $wonItems, 'receipt');

        return Pdf::loadView('pdf.receipt', $data)
            ->setPaper('a4')
            ->setOption('defaultFont', 'ipagothic')
            ->setOption('isRemoteEnabled', true);
    }

    /**
     * ユーザーの表示名を「会社名 → 屋号 → 名前」の優先順で解決する。
     * 請求書・納品書・支払通知書の宛先表記で共通利用。
     */
    private function resolveUserDisplayName(?User $user): string
    {
        if (!$user) {
            return '';
        }
        foreach (['company_name', 'trade_name', 'name'] as $field) {
            $value = trim((string) ($user->{$field} ?? ''));
            if ($value !== '') {
                return $value;
            }
        }
        return '';
    }

    private function getWonItems(Auction $auction, User $winner): Collection
    {
        $wonItems = WonItem::where('winner_id', $winner->id)
            ->whereHas('item', fn ($q) => $q->where('auction_id', $auction->id))
            ->with(['item'])
            ->get();

        if ($wonItems->isEmpty()) {
            throw new \RuntimeException('該当する落札品がありません');
        }

        return $wonItems;
    }

    private function buildInvoiceData(Auction $auction, User $winner, Collection $wonItems, string $type): array
    {
        $prefix = $type === 'invoice' ? 'INV' : 'RCP';
        $documentNumber = sprintf('%s-%s-A%05d', $prefix, Carbon::now()->format('Ymd'), $auction->id);

        // 代表の配送先情報（最初の落札品から取得）
        $firstItem = $wonItems->first();

        // 会社情報をシステム設定から取得
        $companyName = SystemSetting::get('company_name', '日本メダカオンライン市場運営事務局');
        $companyAddress = SystemSetting::get('company_address', '');
        $companyPhone = SystemSetting::get('company_phone', '');
        $companyEmail = SystemSetting::get('company_email', '');

        // 振込先情報を個別設定から組み立て
        $bankName = SystemSetting::get('bank_name', '');
        $bankBranch = SystemSetting::get('bank_branch', '');
        $bankAccountType = SystemSetting::get('bank_account_type', '');
        $bankAccountNumber = SystemSetting::get('bank_account_number', '');
        $bankAccountHolder = SystemSetting::get('bank_account_holder', '');
        $bankInfo = '';
        if ($bankName) {
            $parts = array_filter([
                $bankName . ($bankBranch ? " {$bankBranch}" : ''),
                $bankAccountType ? "口座種別: {$bankAccountType}" : '',
                $bankAccountNumber ? "口座番号: {$bankAccountNumber}" : '',
                $bankAccountHolder ? "口座名義: {$bankAccountHolder}" : '',
            ]);
            $bankInfo = implode("\n", $parts);
        }

        // 明細行を構築（小計は単価×数量で明示計算）
        $items = $wonItems->map(function ($wonItem) {
            $item = $wonItem->item;
            $winningPrice = (int) $wonItem->winning_price;
            $quantity = (int) $wonItem->quantity;
            return [
                'item_number' => $item->item_number ?? '',
                'species_name' => $item->species_name ?? '',
                'quantity' => $quantity,
                'quantity_unit' => $this->formatQuantityUnit($item->quantity_unit ?? 'fish'),
                'winning_price' => $winningPrice,
                'line_subtotal' => $winningPrice * $quantity,
                'shipping_fee' => (int) ($wonItem->shipping_fee ?? 0),
            ];
        })->values()->toArray();

        // 合計計算（winning_price は税抜）
        $subtotal = $wonItems->sum(fn ($w) => (int) $w->winning_price * (int) $w->quantity);
        $commissionTotal = $wonItems->sum(fn ($w) => (int) ($w->commission_amount ?? 0));
        $totalShippingFee = $wonItems->sum(fn ($w) => (int) ($w->shipping_fee ?? 0));
        $taxRate = (float) SystemSetting::get('tax_rate', 10);
        $taxAmount = (int) floor(($subtotal + $commissionTotal + $totalShippingFee) * $taxRate / 100);
        $grandTotal = $subtotal + $commissionTotal + $totalShippingFee + $taxAmount;

        // 支払い期限（最も早いもの）
        $paymentDeadline = $wonItems
            ->filter(fn ($w) => $w->payment_deadline)
            ->sortBy('payment_deadline')
            ->first()?->payment_deadline;

        // 入金日（最も遅いもの＝全品入金完了日）
        $paidAt = $wonItems
            ->filter(fn ($w) => $w->paid_at)
            ->sortByDesc('paid_at')
            ->first()?->paid_at;

        // 支払い方法（全品同じ前提、異なる場合は「複数」）
        $methods = $wonItems->pluck('payment_method')->unique()->filter()->values();
        $paymentMethod = $methods->count() === 1
            ? $this->formatPaymentMethod($methods->first())
            : ($methods->count() > 1 ? '複数方法' : '未定');

        return [
            'type' => $type,
            'document_number' => $documentNumber,
            'issue_date' => Carbon::now()->format('Y年m月d日'),
            // 宛先（会社名 → 屋号 → 名前 の優先順）
            'buyer_name' => $this->resolveUserDisplayName($winner),
            'buyer_postal_code' => $firstItem->shipping_postal_code ?? '',
            'buyer_address' => trim(
                ($firstItem->shipping_prefecture ?? '') .
                ($firstItem->shipping_city ?? '') .
                ($firstItem->shipping_address_line1 ?? '') .
                ' ' . ($firstItem->shipping_address_line2 ?? '')
            ),
            // オークション情報
            'auction_title' => $auction->title ?? '',
            'auction_date' => $auction->event_date?->format('Y年m月d日') ?? '',
            // 明細（複数品）
            'items' => $items,
            'subtotal' => $subtotal,
            'commission_total' => $commissionTotal,
            'total_shipping_fee' => $totalShippingFee,
            'shipping_breakdown' => $this->buildShippingBreakdown($wonItems),
            'tax_rate' => $taxRate,
            'tax_amount' => $taxAmount,
            'grand_total' => $grandTotal,
            // 支払い情報
            'payment_method' => $paymentMethod,
            'payment_deadline' => $paymentDeadline?->format('Y年m月d日'),
            'paid_at' => $paidAt?->format('Y年m月d日'),
            // 発行者
            'company_name' => $companyName,
            'company_address' => $companyAddress,
            'company_phone' => $companyPhone,
            'company_email' => $companyEmail,
            'bank_info' => $bankInfo,
        ];
    }

    /**
     * 納品書PDFを生成（オークション×落札者単位）
     */
    public function generateDeliveryNote(Auction $auction, User $winner): \Barryvdh\DomPDF\PDF
    {
        $wonItems = $this->getWonItems($auction, $winner);

        $documentNumber = sprintf('DLV-%s-A%05d-W%05d', Carbon::now()->format('Ymd'), $auction->id, $winner->id);

        $companyName = SystemSetting::get('company_name', '日本メダカオンライン市場運営事務局');
        $companyAddress = SystemSetting::get('company_address', '');
        $companyPhone = SystemSetting::get('company_phone', '');
        $companyEmail = SystemSetting::get('company_email', '');

        $firstItem = $wonItems->first();

        $items = $wonItems->map(function ($wonItem) {
            $item = $wonItem->item;
            $winningPrice = (int) $wonItem->winning_price;
            $quantity = (int) $wonItem->quantity;
            return [
                'item_number' => $item->item_number ?? '',
                'species_name' => $item->species_name ?? '',
                'quantity' => $quantity,
                'quantity_unit' => $this->formatQuantityUnit($item->quantity_unit ?? 'fish'),
                'winning_price' => $winningPrice,
                'line_subtotal' => $winningPrice * $quantity,
                'shipping_fee' => (int) ($wonItem->shipping_fee ?? 0),
            ];
        })->values()->toArray();

        // 合計計算（請求書と同じロジック）
        $subtotal = $wonItems->sum(fn ($w) => (int) $w->winning_price * (int) $w->quantity);
        $commissionTotal = $wonItems->sum(fn ($w) => (int) ($w->commission_amount ?? 0));
        $totalShippingFee = $wonItems->sum(fn ($w) => (int) ($w->shipping_fee ?? 0));
        $taxRate = (float) SystemSetting::get('tax_rate', 10);
        $taxAmount = (int) floor(($subtotal + $commissionTotal + $totalShippingFee) * $taxRate / 100);
        $grandTotal = $subtotal + $commissionTotal + $totalShippingFee + $taxAmount;

        // 配送業者・追跡番号は納品書単位で共通の想定。異なる値があれば連結表示
        $shippingCompany = $wonItems->pluck('shipping_company')->filter()->unique()->values()->implode('、');
        $trackingNumber = $wonItems->pluck('tracking_number')->filter()->unique()->values()->implode('、');
        $deliveryStatuses = $wonItems->pluck('delivery_status')->unique()->values();
        $deliveryStatus = $deliveryStatuses->count() === 1
            ? $this->formatDeliveryStatus($deliveryStatuses->first())
            : '一部発送済み';

        $data = [
            'document_number' => $documentNumber,
            'issue_date' => Carbon::now()->format('Y年m月d日'),
            // 宛先（会社名 → 屋号 → 名前 の優先順）
            'buyer_name' => $this->resolveUserDisplayName($winner),
            'buyer_postal_code' => $firstItem->shipping_postal_code ?? '',
            'buyer_address' => trim(
                ($firstItem->shipping_prefecture ?? '') .
                ($firstItem->shipping_city ?? '') .
                ($firstItem->shipping_address_line1 ?? '') .
                ' ' . ($firstItem->shipping_address_line2 ?? '')
            ),
            'buyer_phone' => $firstItem->shipping_phone ?? '',
            'auction_title' => $auction->title ?? '',
            'auction_date' => $auction->event_date?->format('Y年m月d日') ?? '',
            'items' => $items,
            'subtotal' => $subtotal,
            'commission_total' => $commissionTotal,
            'total_shipping_fee' => $totalShippingFee,
            'shipping_breakdown' => $this->buildShippingBreakdown($wonItems),
            'tax_rate' => $taxRate,
            'tax_amount' => $taxAmount,
            'grand_total' => $grandTotal,
            'total_items_count' => count($items),
            'shipping_company' => $shippingCompany,
            'tracking_number' => $trackingNumber,
            'delivery_status' => $deliveryStatus,
            'company_name' => $companyName,
            'company_address' => $companyAddress,
            'company_phone' => $companyPhone,
            'company_email' => $companyEmail,
        ];

        return Pdf::loadView('pdf.delivery_note', $data)
            ->setPaper('a4')
            ->setOption('defaultFont', 'ipagothic')
            ->setOption('isRemoteEnabled', true);
    }

    /**
     * 落札者×オークション単位の送料内訳を整形する。
     *
     * shipping_breakdown は FinishAuctionAction で同一落札者の全 WonItem に
     * 同じ JSON が複製保存されているため、先頭から取り出して使う（合算しない）。
     * breakdown 不在（旧データ／手動運用）の場合は null を返し、PDF 側で非表示にする。
     */
    public function buildShippingBreakdown(Collection $wonItems): ?array
    {
        // 送料合計が0円（引き取り等）の場合は内訳自体を出さない
        $totalFee = (int) $wonItems->sum(fn ($w) => (int) ($w->shipping_fee ?? 0));
        if ($totalFee === 0) {
            return null;
        }

        $first = $wonItems->first(
            fn ($w) => is_array($w->shipping_breakdown) && !empty($w->shipping_breakdown)
        );
        if (!$first) {
            return null;
        }

        $bd = $first->shipping_breakdown;
        $mode = $bd['calculation_mode'] ?? 'auto';

        $speciesSubtotals = array_map(fn ($s) => [
            'species_name' => $s['species_name'] ?? '',
            'quantity' => (int) ($s['quantity'] ?? 0),
            'subtotal_fee' => isset($s['subtotal_fee']) && $s['subtotal_fee'] !== null
                ? (int) $s['subtotal_fee']
                : null,
        ], $bd['species_breakdown'] ?? []);

        if ($mode === 'manual') {
            return [
                'mode' => 'manual',
                'region' => $bd['destination_region'] ?? null,
                'manual_reason' => $bd['manual_reason'] ?? '管理者により個別に設定された送料です。',
                'manual_total' => (int) $wonItems->sum(fn ($w) => (int) ($w->shipping_fee ?? 0)),
                'species_subtotals' => $speciesSubtotals,
                'boxes' => [],
                'shipping_cost_total' => 0,
                'packing_cost_total' => 0,
                'total_shipping_fee' => 0,
            ];
        }

        // auto / mixed: 箱サイズ別に集計
        $boxAgg = [];
        foreach (($bd['boxes'] ?? []) as $box) {
            $size = $box['box_size'] ?? '?';
            if (!isset($boxAgg[$size])) {
                $boxAgg[$size] = ['count' => 0, 'shipping_cost' => 0, 'packing_cost' => 0];
            }
            $boxAgg[$size]['count'] += 1;
            $boxAgg[$size]['shipping_cost'] += (int) ($box['shipping_cost'] ?? 0);
            $boxAgg[$size]['packing_cost'] += (int) ($box['packing_material_cost'] ?? 0);
        }
        ksort($boxAgg);

        $boxes = [];
        foreach ($boxAgg as $size => $a) {
            $boxes[] = [
                'box_size' => $size,
                'count' => $a['count'],
                'shipping_cost' => $a['shipping_cost'],
                'packing_cost' => $a['packing_cost'],
                'subtotal' => $a['shipping_cost'] + $a['packing_cost'],
            ];
        }

        return [
            'mode' => $mode,
            'region' => $bd['destination_region'] ?? null,
            'boxes' => $boxes,
            'shipping_cost_total' => (int) ($bd['shipping_cost'] ?? 0),
            'packing_cost_total' => (int) ($bd['packing_material_cost'] ?? 0),
            'total_shipping_fee' => (int) ($bd['total_shipping_fee'] ?? 0),
            'species_subtotals' => $speciesSubtotals,
        ];
    }

    private function formatDeliveryStatus(?string $status): string
    {
        return match ($status) {
            'preparing' => '準備中',
            'shipped' => '発送済み',
            'completed' => '配達完了',
            default => '未発送',
        };
    }

    private function formatQuantityUnit(?string $unit): string
    {
        return match ($unit) {
            'kg' => 'kg',
            'bag' => '袋',
            default => '匹',
        };
    }

    /**
     * 出品者支払通知書PDFを生成（オークション×出品者単位）
     */
    public function generateSellerPaymentNotice(Auction $auction, SellerProfile $seller): \Barryvdh\DomPDF\PDF
    {
        // この出品者がこのオークションで売った落札品を取得
        $wonItems = WonItem::whereHas('item', fn ($q) => $q
            ->where('auction_id', $auction->id)
            ->where('seller_profile_id', $seller->id)
        )->with(['item', 'winner'])->get();

        if ($wonItems->isEmpty()) {
            throw new \RuntimeException('該当する売上データがありません');
        }

        $documentNumber = sprintf('PAY-%s-A%05d-S%05d', Carbon::now()->format('Ymd'), $auction->id, $seller->id);

        // 会社情報
        $companyName = SystemSetting::get('company_name', '日本メダカオンライン市場運営事務局');
        $companyAddress = SystemSetting::get('company_address', '');
        $companyPhone = SystemSetting::get('company_phone', '');
        $companyEmail = SystemSetting::get('company_email', '');

        // 明細（落札金額=winning_price×quantity 税抜、手数料=買い手手数料 税抜）
        $items = $wonItems->map(function ($wonItem) {
            $winningAmount = (int) $wonItem->winning_price * (int) $wonItem->quantity;
            return [
                'item_number' => $wonItem->item->item_number ?? '',
                'species_name' => $wonItem->item->species_name ?? '',
                'quantity' => $wonItem->quantity,
                'winning_amount' => $winningAmount,
                'commission_amount' => (int) $wonItem->commission_amount,
            ];
        })->values()->toArray();

        // 税抜小計（落札金額・手数料を独立して集計）
        $subtotalWinning = (int) $wonItems->sum(fn ($w) => (int) $w->winning_price * (int) $w->quantity);
        $subtotalCommission = (int) $wonItems->sum(fn ($w) => (int) $w->commission_amount);

        // 消費税（SystemSetting::tax_rate, 既定 10%）。InvoiceService と揃えて floor で丸める
        $taxRate = (float) SystemSetting::get('tax_rate', 10);
        $taxWinning = (int) floor($subtotalWinning * $taxRate / 100);
        $taxCommission = (int) floor($subtotalCommission * $taxRate / 100);

        $totalWinningWithTax = $subtotalWinning + $taxWinning;
        $totalCommissionWithTax = $subtotalCommission + $taxCommission;
        $netAmount = $totalWinningWithTax - $totalCommissionWithTax;

        // 振込予定日（オークション終了7日後）
        $paymentDate = $auction->event_date?->addDays(7);

        $data = [
            'document_number' => $documentNumber,
            'issue_date' => Carbon::now()->format('Y年m月d日'),
            // 出品者名（会社名 → 屋号 → 名前 の優先順、users 直参照）
            'seller_name' => $this->resolveUserDisplayName($seller->user),
            'auction_title' => $auction->title ?? '',
            'auction_date' => $auction->event_date?->format('Y年m月d日') ?? '',
            'items' => $items,
            'subtotal_winning' => $subtotalWinning,
            'subtotal_commission' => $subtotalCommission,
            'tax_rate' => $taxRate,
            'tax_winning' => $taxWinning,
            'tax_commission' => $taxCommission,
            'total_winning_with_tax' => $totalWinningWithTax,
            'total_commission_with_tax' => $totalCommissionWithTax,
            'net_amount' => $netAmount,
            // 振込先
            'bank_name' => $seller->bank_name ?? '',
            'bank_branch' => $seller->bank_branch ?? '',
            'account_type' => $seller->account_type === 'checking' ? '当座' : '普通',
            'account_number' => $seller->account_number ?? '',
            'account_holder' => $seller->account_holder ?? '',
            'payment_scheduled_date' => $paymentDate?->format('Y年m月d日'),
            // 発行者
            'company_name' => $companyName,
            'company_address' => $companyAddress,
            'company_phone' => $companyPhone,
            'company_email' => $companyEmail,
        ];

        return Pdf::loadView('pdf.seller_payment_notice', $data)
            ->setPaper('a4')
            ->setOption('defaultFont', 'ipagothic')
            ->setOption('isRemoteEnabled', true);
    }

    private function formatPaymentMethod(?string $method): string
    {
        return match ($method) {
            'bank_transfer' => '銀行振込',
            'credit_card' => 'クレジットカード',
            'cash' => '現金',
            'onsite' => '現地支払い',
            default => '未定',
        };
    }
}
