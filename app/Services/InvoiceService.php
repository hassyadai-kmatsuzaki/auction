<?php

namespace App\Services;

use App\Models\Auction;
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
        $companyName = SystemSetting::get('company_name', 'メダカオークション運営事務局');
        $companyAddress = SystemSetting::get('company_address', '');
        $companyPhone = SystemSetting::get('company_phone', '');
        $companyEmail = SystemSetting::get('company_email', '');
        $bankInfo = SystemSetting::get('bank_info', '');

        // 明細行を構築
        $items = $wonItems->map(function ($wonItem) {
            $item = $wonItem->item;
            return [
                'item_number' => $item->item_number ?? '',
                'species_name' => $item->species_name ?? '',
                'quantity' => $wonItem->quantity,
                'winning_price' => (int) $wonItem->winning_price,
                'total_amount' => (int) $wonItem->total_amount,
                'shipping_fee' => $wonItem->shipping_fee ?? 0,
            ];
        })->values()->toArray();

        // 合計計算
        $subtotal = $wonItems->sum(fn ($w) => (int) $w->total_amount);
        $totalShippingFee = $wonItems->sum(fn ($w) => $w->shipping_fee ?? 0);
        $grandTotal = $subtotal + $totalShippingFee;

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
            // 宛先
            'buyer_name' => $firstItem->shipping_name ?? $winner->name ?? '',
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
            'total_shipping_fee' => $totalShippingFee,
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
