<?php

namespace App\Services;

use App\Models\WonItem;
use App\Models\SystemSetting;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

class InvoiceService
{
    /**
     * 落札者向け請求書PDFを生成
     */
    public function generateInvoice(WonItem $wonItem): \Barryvdh\DomPDF\PDF
    {
        $wonItem->load(['item.auction', 'winner']);

        $data = $this->buildInvoiceData($wonItem, 'invoice');

        return Pdf::loadView('pdf.invoice', $data)
            ->setPaper('a4')
            ->setOption('defaultFont', 'ipagothic')
            ->setOption('isRemoteEnabled', true);
    }

    /**
     * 落札者向け領収書PDFを生成
     */
    public function generateReceipt(WonItem $wonItem): \Barryvdh\DomPDF\PDF
    {
        $wonItem->load(['item.auction', 'winner']);

        $data = $this->buildInvoiceData($wonItem, 'receipt');

        return Pdf::loadView('pdf.receipt', $data)
            ->setPaper('a4')
            ->setOption('defaultFont', 'ipagothic')
            ->setOption('isRemoteEnabled', true);
    }

    private function buildInvoiceData(WonItem $wonItem, string $type): array
    {
        $prefix = $type === 'invoice' ? 'INV' : 'RCP';
        $documentNumber = sprintf('%s-%s-%05d', $prefix, Carbon::now()->format('Ymd'), $wonItem->id);

        $item = $wonItem->item;
        $auction = $item->auction ?? null;
        $winner = $wonItem->winner;

        // 会社情報をシステム設定から取得
        $companyName = SystemSetting::get('company_name', 'メダカオークション運営事務局');
        $companyAddress = SystemSetting::get('company_address', '');
        $companyPhone = SystemSetting::get('company_phone', '');
        $companyEmail = SystemSetting::get('company_email', '');
        $bankInfo = SystemSetting::get('bank_info', '');

        return [
            'type' => $type,
            'document_number' => $documentNumber,
            'issue_date' => Carbon::now()->format('Y年m月d日'),
            // 宛先
            'buyer_name' => $wonItem->shipping_name ?? $winner->name ?? '',
            'buyer_postal_code' => $wonItem->shipping_postal_code ?? '',
            'buyer_address' => trim(
                ($wonItem->shipping_prefecture ?? '') .
                ($wonItem->shipping_city ?? '') .
                ($wonItem->shipping_address_line1 ?? '') .
                ' ' . ($wonItem->shipping_address_line2 ?? '')
            ),
            // 明細
            'auction_title' => $auction?->title ?? '',
            'auction_date' => $auction?->event_date?->format('Y年m月d日') ?? '',
            'item_number' => $item->item_number ?? '',
            'species_name' => $item->species_name ?? '',
            'quantity' => $wonItem->quantity,
            'winning_price' => (int) $wonItem->winning_price,
            'total_amount' => (int) $wonItem->total_amount,
            'shipping_fee' => $wonItem->shipping_fee,
            'grand_total' => (int) $wonItem->total_amount + $wonItem->shipping_fee,
            // 支払い情報
            'payment_method' => $this->formatPaymentMethod($wonItem->payment_method),
            'payment_deadline' => $wonItem->payment_deadline?->format('Y年m月d日'),
            'paid_at' => $wonItem->paid_at?->format('Y年m月d日'),
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
