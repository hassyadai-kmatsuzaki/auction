<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Auction;
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
     * 請求書PDFダウンロード（落札者向け・オークション単位）
     * GET /api/participant/auctions/{auctionId}/invoice
     */
    public function downloadInvoice(int $auctionId)
    {
        $auction = Auction::findOrFail($auctionId);
        $winner = Auth::user();

        // このオークションに落札品があるか確認
        $hasItems = WonItem::where('winner_id', $winner->id)
            ->whereHas('item', fn ($q) => $q->where('auction_id', $auctionId))
            ->exists();

        if (!$hasItems) {
            return response()->json(['message' => '該当する落札品がありません'], 404);
        }

        try {
            $pdf = $this->invoiceService->generateInvoice($auction, $winner);
            $content = $pdf->output();

            return response($content, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "attachment; filename=\"invoice_auction_{$auctionId}.pdf\"",
                'Content-Length' => strlen($content),
            ]);
        } catch (\Throwable $e) {
            Log::error('請求書PDF生成エラー', [
                'auction_id' => $auctionId,
                'winner_id' => $winner->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['message' => '請求書の生成に失敗しました'], 500);
        }
    }

    /**
     * 領収書PDFダウンロード（落札者向け・オークション単位）
     * GET /api/participant/auctions/{auctionId}/receipt
     */
    public function downloadReceipt(int $auctionId)
    {
        $auction = Auction::findOrFail($auctionId);
        $winner = Auth::user();

        // 入金確認済みの落札品があるか確認
        $hasPaidItems = WonItem::where('winner_id', $winner->id)
            ->whereHas('item', fn ($q) => $q->where('auction_id', $auctionId))
            ->whereIn('payment_status', ['paid', 'confirmed'])
            ->exists();

        if (!$hasPaidItems) {
            return response()->json(['message' => '入金確認済みの落札品がありません'], 404);
        }

        try {
            $pdf = $this->invoiceService->generateReceipt($auction, $winner);
            $content = $pdf->output();

            return response($content, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "attachment; filename=\"receipt_auction_{$auctionId}.pdf\"",
                'Content-Length' => strlen($content),
            ]);
        } catch (\Throwable $e) {
            Log::error('領収書PDF生成エラー', [
                'auction_id' => $auctionId,
                'winner_id' => $winner->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['message' => '領収書の生成に失敗しました'], 500);
        }
    }

    /**
     * 請求書PDFダウンロード（管理者向け・オークション×落札者単位）
     * GET /api/admin/auctions/{auctionId}/winners/{winnerId}/invoice
     */
    public function adminDownloadInvoice(int $auctionId, int $winnerId)
    {
        $auction = Auction::findOrFail($auctionId);
        $winner = \App\Models\User::findOrFail($winnerId);

        try {
            $pdf = $this->invoiceService->generateInvoice($auction, $winner);
            $content = $pdf->output();

            return response($content, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "attachment; filename=\"invoice_auction_{$auctionId}_winner_{$winnerId}.pdf\"",
                'Content-Length' => strlen($content),
            ]);
        } catch (\Throwable $e) {
            Log::error('請求書PDF生成エラー（管理者）', [
                'auction_id' => $auctionId,
                'winner_id' => $winnerId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['message' => '請求書の生成に失敗しました'], 500);
        }
    }
}
