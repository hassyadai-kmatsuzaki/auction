<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WonItem;
use App\Services\InvoiceService;
use Illuminate\Support\Facades\Auth;

class InvoiceController extends Controller
{
    public function __construct(
        private InvoiceService $invoiceService
    ) {}

    /**
     * 請求書PDFダウンロード（落札者向け）
     * GET /api/participant/won-items/{id}/invoice
     */
    public function downloadInvoice(int $id)
    {
        $wonItem = WonItem::where('winner_id', Auth::id())->findOrFail($id);

        $pdf = $this->invoiceService->generateInvoice($wonItem);

        return $pdf->download("invoice_{$wonItem->id}.pdf");
    }

    /**
     * 領収書PDFダウンロード（落札者向け、入金確認済みのみ）
     * GET /api/participant/won-items/{id}/receipt
     */
    public function downloadReceipt(int $id)
    {
        $wonItem = WonItem::where('winner_id', Auth::id())
            ->whereIn('payment_status', ['paid', 'confirmed'])
            ->findOrFail($id);

        $pdf = $this->invoiceService->generateReceipt($wonItem);

        return $pdf->download("receipt_{$wonItem->id}.pdf");
    }

    /**
     * 請求書PDFダウンロード（管理者向け）
     * GET /api/admin/won-items/{id}/invoice
     */
    public function adminDownloadInvoice(int $id)
    {
        $wonItem = WonItem::findOrFail($id);

        $pdf = $this->invoiceService->generateInvoice($wonItem);

        return $pdf->download("invoice_{$wonItem->id}.pdf");
    }
}
