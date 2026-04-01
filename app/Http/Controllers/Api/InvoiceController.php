<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WonItem;
use App\Services\InvoiceService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

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

        try {
            $pdf = $this->invoiceService->generateInvoice($wonItem);
            $content = $pdf->output();

            return response($content, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "attachment; filename=\"invoice_{$wonItem->id}.pdf\"",
                'Content-Length' => strlen($content),
            ]);
        } catch (\Throwable $e) {
            Log::error('請求書PDF生成エラー', [
                'won_item_id' => $wonItem->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['message' => '請求書の生成に失敗しました'], 500);
        }
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

        try {
            $pdf = $this->invoiceService->generateReceipt($wonItem);
            $content = $pdf->output();

            return response($content, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "attachment; filename=\"receipt_{$wonItem->id}.pdf\"",
                'Content-Length' => strlen($content),
            ]);
        } catch (\Throwable $e) {
            Log::error('領収書PDF生成エラー', [
                'won_item_id' => $wonItem->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['message' => '領収書の生成に失敗しました'], 500);
        }
    }

    /**
     * 請求書PDFダウンロード（管理者向け）
     * GET /api/admin/won-items/{id}/invoice
     */
    public function adminDownloadInvoice(int $id)
    {
        $wonItem = WonItem::findOrFail($id);

        try {
            $pdf = $this->invoiceService->generateInvoice($wonItem);
            $content = $pdf->output();

            return response($content, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "attachment; filename=\"invoice_{$wonItem->id}.pdf\"",
                'Content-Length' => strlen($content),
            ]);
        } catch (\Throwable $e) {
            Log::error('請求書PDF生成エラー（管理者）', [
                'won_item_id' => $wonItem->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['message' => '請求書の生成に失敗しました'], 500);
        }
    }
}
