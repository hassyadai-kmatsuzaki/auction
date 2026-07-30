<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\SellerSettlement;
use App\Models\SystemSetting;
use App\Models\WonItem;
use App\Services\InvoiceTaxResolver;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class DocumentController extends Controller
{
    /**
     * 請求書一覧（オークション×落札者単位でグルーピング）
     * GET /api/admin/documents/invoices
     */
    public function invoices(Request $request)
    {
        $query = WonItem::with(['item.auction', 'winner'])
            ->whereHas('item.auction');

        if ($auctionId = $request->input('auction_id')) {
            $query->whereHas('item', fn ($q) => $q->where('auction_id', $auctionId));
        }

        $wonItems = $query->get();

        // InvoiceService::buildInvoiceData と同じ式で税込合計を組み立てる
        $taxRate = (float) SystemSetting::get('tax_rate', 10);

        $grouped = $wonItems
            ->filter(fn ($w) => $w->item && $w->item->auction && $w->winner)
            ->groupBy(fn ($w) => $w->item->auction_id.'-'.$w->winner_id)
            ->map(function ($group) use ($taxRate) {
                $first = $group->first();
                $auction = $first->item->auction;
                $winner = $first->winner;

                $subtotal = (int) $group->sum(fn ($w) => (int) $w->winning_price * (int) $w->quantity);
                $commissionTotal = (int) $group->sum(fn ($w) => (int) ($w->commission_amount ?? 0));
                $shippingFeeTotal = (int) $group->sum(fn ($w) => (int) ($w->shipping_fee ?? 0));
                $taxAmount = (int) floor(($subtotal + $commissionTotal + $shippingFeeTotal) * $taxRate / 100);
                $totalAmount = $subtotal + $commissionTotal + $shippingFeeTotal + $taxAmount;

                $statuses = $group->pluck('payment_status')->unique();
                $status = 'pending';
                if ($statuses->every(fn ($s) => in_array($s, ['paid', 'confirmed']))) {
                    $status = 'paid';
                } elseif ($group->contains(fn ($w) => $w->payment_deadline && $w->payment_deadline->isPast() && !in_array($w->payment_status, ['paid', 'confirmed']))) {
                    $status = 'overdue';
                }

                $paidAt = $group->filter(fn ($w) => $w->paid_at)->sortByDesc('paid_at')->first()?->paid_at;

                return [
                    'auction_id' => $auction->id,
                    'winner_id' => $winner->id,
                    'invoice_number' => sprintf('INV-A%05d-W%05d', $auction->id, $winner->id),
                    'buyer' => [
                        'id' => $winner->id,
                        'name' => $winner->name,
                        'email' => $winner->email,
                    ],
                    'auction' => $auction->title,
                    'items_count' => $group->count(),
                    'total_amount' => $totalAmount,
                    'status' => $status,
                    'issued_at' => $first->created_at?->toIso8601String(),
                    'paid_at' => $paidAt?->toIso8601String(),
                ];
            })
            ->values();

        return response()->json(['success' => true, 'data' => $grouped]);
    }

    /**
     * 支払通知書一覧（オークション×出品者単位）
     * GET /api/admin/documents/payment-notices
     */
    public function paymentNotices(Request $request)
    {
        $query = WonItem::with(['item.auction', 'item.sellerProfile.user']);

        if ($auctionId = $request->input('auction_id')) {
            $query->whereHas('item', fn ($q) => $q->where('auction_id', $auctionId));
        }

        $wonItems = $query->get();

        $resolver = app(InvoiceTaxResolver::class);

        // 一斉通知の送信記録（auctionId-sellerProfileId → sent_at）
        $sentAtMap = SellerSettlement::query()
            ->whereNotNull('payment_notice_sent_at')
            ->get(['auction_id', 'seller_profile_id', 'payment_notice_sent_at'])
            ->keyBy(fn ($s) => $s->auction_id.'-'.$s->seller_profile_id);

        $grouped = $wonItems
            ->filter(fn ($w) => $w->item && $w->item->auction && $w->item->sellerProfile)
            ->groupBy(fn ($w) => $w->item->auction_id.'-'.$w->item->seller_profile_id)
            ->map(function ($group, $groupKey) use ($resolver, $sentAtMap) {
                $first = $group->first();
                $auction = $first->item->auction;
                $seller = $first->item->sellerProfile;

                // 税抜小計（落札金額=winning_price×quantity, 手数料=買い手手数料）
                $subtotalWinning = (int) $group->sum(fn ($w) => (int) $w->winning_price * (int) $w->quantity);
                $subtotalCommission = (int) $group->sum(fn ($w) => (int) $w->commission_amount);

                // 消費税率（落札分は免税事業者なら経過措置率、手数料は常に 10%）
                $taxMeta = $resolver->resolve($auction, $seller);

                // 税込（floor 丸め、PDF/精算詳細と統一）
                $salesAmount = $subtotalWinning + (int) floor($subtotalWinning * $taxMeta['winning_tax_rate'] / 100);
                $commission = $subtotalCommission + (int) floor($subtotalCommission * $taxMeta['commission_tax_rate'] / 100);
                $netAmount = $salesAmount - $commission;

                // ステータス: 全件入金確認済みなら sent, それ以外は draft
                $allConfirmed = $group->every(fn ($w) => in_array($w->payment_status, ['paid', 'confirmed']));
                $status = $allConfirmed ? 'sent' : 'draft';

                $transferScheduled = $auction->event_date?->copy()->addDays(7);

                return [
                    'auction_id' => $auction->id,
                    'seller_id' => $seller->id,
                    'notice_number' => sprintf('PAY-A%05d-S%05d', $auction->id, $seller->id),
                    'seller' => [
                        'id' => $seller->id,
                        'name' => $seller->display_name ?? $seller->user->name ?? '',
                        'email' => $seller->user->email ?? '',
                    ],
                    'auction' => $auction->title,
                    'items_count' => $group->count(),
                    'sales_amount' => $salesAmount,
                    'commission' => $commission,
                    'net_amount' => $netAmount,
                    'status' => $status,
                    'issued_at' => $allConfirmed ? $first->created_at?->toIso8601String() : null,
                    'transfer_scheduled' => $transferScheduled?->format('Y-m-d'),
                    'is_tax_exempt' => $taxMeta['is_tax_exempt'],
                    'winning_tax_rate' => $taxMeta['winning_tax_rate'],
                    'transition_rate' => $taxMeta['transition_rate'],
                    'notice_sent_at' => $sentAtMap->get($groupKey)?->payment_notice_sent_at?->toIso8601String(),
                ];
            })
            ->values();

        return response()->json(['success' => true, 'data' => $grouped]);
    }

    /**
     * 支払通知書の一斉通知（オークション単位・管理画面ボタンから）
     * POST /api/admin/documents/payment-notices/notify
     *
     * 対象オークションで売上のある出品者全員に、LINE連携済みならLINE、
     * 未連携ならメール（PDF添付）で支払通知書を届ける。
     */
    public function notifyPaymentNotices(Request $request, NotificationService $notificationService)
    {
        $validated = $request->validate([
            'auction_id' => 'required|integer|exists:auctions,id',
        ]);

        $auction = Auction::findOrFail($validated['auction_id']);

        // 開催前/開催中は金額が確定していないため送信させない
        if ($auction->status !== 'finished') {
            return response()->json([
                'success' => false,
                'message' => '終了済みのオークションのみ送信できます。',
            ], 400);
        }

        $sellerProfileIds = WonItem::query()
            ->join('items', 'won_items.item_id', '=', 'items.id')
            ->where('items.auction_id', $auction->id)
            ->whereNotNull('items.seller_profile_id')
            ->distinct()
            ->pluck('items.seller_profile_id');

        if ($sellerProfileIds->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => '対象の売上データがありません。',
            ], 404);
        }

        $counts = ['line' => 0, 'mail' => 0, 'skipped' => 0];

        foreach (SellerProfile::with('user')->whereIn('id', $sellerProfileIds)->get() as $sellerProfile) {
            $channel = $notificationService->sendSellerPaymentNoticeNotification($auction, $sellerProfile);
            $counts[$channel] = ($counts[$channel] ?? 0) + 1;

            if ($channel !== 'skipped') {
                $settlement = SellerSettlement::firstOrCreate(
                    ['auction_id' => $auction->id, 'seller_profile_id' => $sellerProfile->id],
                    ['status' => SellerSettlement::STATUS_PENDING],
                );
                $settlement->fill([
                    'payment_notice_sent_at' => now(),
                    'payment_notice_sent_by' => Auth::id(),
                ])->save();
            }
        }

        Log::info('支払通知書一斉通知', [
            'auction_id' => $auction->id,
            'admin_id' => Auth::id(),
            'counts' => $counts,
        ]);

        return response()->json([
            'success' => true,
            'message' => sprintf(
                '送信しました（LINE: %d件 / メール: %d件 / スキップ: %d件）',
                $counts['line'], $counts['mail'], $counts['skipped'],
            ),
            'data' => $counts,
        ]);
    }

    /**
     * 納品書一覧（オークション×落札者単位）
     * GET /api/admin/documents/delivery-notes
     */
    public function deliveryNotes(Request $request)
    {
        $query = WonItem::with(['item.auction', 'winner']);

        if ($auctionId = $request->input('auction_id')) {
            $query->whereHas('item', fn ($q) => $q->where('auction_id', $auctionId));
        }

        $wonItems = $query->get();

        $grouped = $wonItems
            ->filter(fn ($w) => $w->item && $w->item->auction && $w->winner)
            ->groupBy(fn ($w) => $w->item->auction_id.'-'.$w->winner_id)
            ->map(function ($group) {
                $first = $group->first();
                $auction = $first->item->auction;
                $winner = $first->winner;

                $totalQuantity = $group->sum('quantity');
                $shippedAt = $group->filter(fn ($w) => $w->shipped_at)->sortBy('shipped_at')->first()?->shipped_at;

                $statuses = $group->pluck('delivery_status')->unique();
                $status = 'preparing';
                if ($statuses->every(fn ($s) => $s === 'completed')) {
                    $status = 'completed';
                } elseif ($statuses->every(fn ($s) => in_array($s, ['shipped', 'completed']))) {
                    $status = 'shipped';
                }

                return [
                    'auction_id' => $auction->id,
                    'winner_id' => $winner->id,
                    'delivery_note_number' => sprintf('DLV-A%05d-W%05d', $auction->id, $winner->id),
                    'buyer' => [
                        'id' => $winner->id,
                        'name' => $winner->name,
                        'email' => $winner->email,
                    ],
                    'auction' => $auction->title,
                    'items_count' => $group->count(),
                    'total_quantity' => $totalQuantity,
                    'status' => $status,
                    'shipped_at' => $shippedAt?->toIso8601String(),
                    'issued_at' => $first->created_at?->toIso8601String(),
                ];
            })
            ->values();

        return response()->json(['success' => true, 'data' => $grouped]);
    }
}
