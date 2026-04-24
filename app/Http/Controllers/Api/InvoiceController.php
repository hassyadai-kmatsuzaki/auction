<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\SellerProfile;
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
        $wonItems = WonItem::where('winner_id', $winner->id)
            ->whereHas('item', fn ($q) => $q->where('auction_id', $auctionId))
            ->get();

        if ($wonItems->isEmpty()) {
            return response()->json(['message' => '該当する落札品がありません'], 404);
        }

        // 管理者による送料承認チェック（承認前は落札者に開示しない）
        if ($wonItems->contains(fn ($w) => $w->shipping_approved_at === null)) {
            return response()->json(['message' => '送料の確定後にダウンロードできます'], 400);
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

        // 落札品チェック
        $wonItems = WonItem::where('winner_id', $winner->id)
            ->whereHas('item', fn ($q) => $q->where('auction_id', $auctionId))
            ->get();

        $paidItems = $wonItems->filter(fn ($w) => in_array($w->payment_status, ['paid', 'confirmed']));
        if ($paidItems->isEmpty()) {
            return response()->json(['message' => '入金確認済みの落札品がありません'], 404);
        }

        // 管理者による送料承認チェック
        if ($wonItems->contains(fn ($w) => $w->shipping_approved_at === null)) {
            return response()->json(['message' => '送料の確定後にダウンロードできます'], 400);
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

    /**
     * 納品書PDFダウンロード（管理者向け・オークション×落札者単位）
     * GET /api/admin/auctions/{auctionId}/winners/{winnerId}/delivery-note
     */
    public function adminDownloadDeliveryNote(int $auctionId, int $winnerId)
    {
        $auction = Auction::findOrFail($auctionId);
        $winner = \App\Models\User::findOrFail($winnerId);

        try {
            $pdf = $this->invoiceService->generateDeliveryNote($auction, $winner);
            $content = $pdf->output();

            return response($content, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "attachment; filename=\"delivery_note_auction_{$auctionId}_winner_{$winnerId}.pdf\"",
                'Content-Length' => strlen($content),
            ]);
        } catch (\Throwable $e) {
            Log::error('納品書PDF生成エラー（管理者）', [
                'auction_id' => $auctionId,
                'winner_id' => $winnerId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['message' => '納品書の生成に失敗しました'], 500);
        }
    }

    /**
     * 出品者支払通知書PDFダウンロード（管理者向け）
     * GET /api/admin/auctions/{auctionId}/sellers/{sellerId}/payment-notice
     */
    public function adminDownloadPaymentNotice(int $auctionId, int $sellerId)
    {
        $auction = Auction::findOrFail($auctionId);
        $seller = SellerProfile::findOrFail($sellerId);

        try {
            $pdf = $this->invoiceService->generateSellerPaymentNotice($auction, $seller);
            $content = $pdf->output();

            return response($content, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "attachment; filename=\"payment_notice_auction_{$auctionId}_seller_{$sellerId}.pdf\"",
                'Content-Length' => strlen($content),
            ]);
        } catch (\Throwable $e) {
            Log::error('支払通知書PDF生成エラー', [
                'auction_id' => $auctionId,
                'seller_id' => $sellerId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['message' => '支払通知書の生成に失敗しました'], 500);
        }
    }

    /**
     * LINE 通知からアクセスされる請求書 PDF ダウンロード（signed URL で保護）
     * GET /api/line/invoices/{auctionId}/{winnerId}?expires=...&signature=...
     *
     * LINE アプリ内ブラウザは通常セッションが無いため、認証ではなく signed URL で保護する。
     */
    public function lineDownloadInvoice(int $auctionId, int $winnerId)
    {
        $auction = Auction::findOrFail($auctionId);
        $winner = \App\Models\User::findOrFail($winnerId);

        try {
            $pdf = $this->invoiceService->generateInvoice($auction, $winner);
            $content = $pdf->output();

            return response($content, 200, [
                'Content-Type'        => 'application/pdf',
                'Content-Disposition' => "inline; filename=\"invoice_auction_{$auctionId}.pdf\"",
                'Content-Length'      => strlen($content),
            ]);
        } catch (\Throwable $e) {
            Log::error('LINE 請求書PDF生成エラー', [
                'auction_id' => $auctionId,
                'winner_id'  => $winnerId,
                'error'      => $e->getMessage(),
            ]);
            return response()->json(['message' => '請求書の生成に失敗しました'], 500);
        }
    }

    /**
     * 出品者支払通知書PDFダウンロード（出品者向け）
     * GET /api/seller/settlements/{auctionId}/payment-notice
     */
    public function sellerDownloadPaymentNotice(int $auctionId)
    {
        $auction = Auction::findOrFail($auctionId);
        $user = Auth::user();
        $seller = SellerProfile::where('user_id', $user->id)->firstOrFail();

        // この出品者がこのオークションで売ったアイテムがあるか確認
        $hasItems = WonItem::whereHas('item', fn ($q) => $q
            ->where('auction_id', $auctionId)
            ->where('seller_profile_id', $seller->id)
        )->exists();

        if (!$hasItems) {
            return response()->json(['message' => '該当する売上データがありません'], 404);
        }

        try {
            $pdf = $this->invoiceService->generateSellerPaymentNotice($auction, $seller);
            $content = $pdf->output();

            return response($content, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "attachment; filename=\"payment_notice_auction_{$auctionId}.pdf\"",
                'Content-Length' => strlen($content),
            ]);
        } catch (\Throwable $e) {
            Log::error('支払通知書PDF生成エラー（出品者）', [
                'auction_id' => $auctionId,
                'seller_id' => $seller->id,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => '支払通知書の生成に失敗しました'], 500);
        }
    }
}
