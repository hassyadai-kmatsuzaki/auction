<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\SystemSetting;
use App\Models\WonItem;
use Illuminate\Http\Request;

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

        $grouped = $wonItems
            ->filter(fn ($w) => $w->item && $w->item->auction && $w->winner)
            ->groupBy(fn ($w) => $w->item->auction_id.'-'.$w->winner_id)
            ->map(function ($group) {
                $first = $group->first();
                $auction = $first->item->auction;
                $winner = $first->winner;

                $totalAmount = $group->sum(fn ($w) => (int) $w->total_amount) + $group->sum(fn ($w) => $w->shipping_fee ?? 0);

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

        // 消費税率（SystemSetting::tax_rate, 既定 10%）
        $taxRate = (float) SystemSetting::get('tax_rate', 10);

        $grouped = $wonItems
            ->filter(fn ($w) => $w->item && $w->item->auction && $w->item->sellerProfile)
            ->groupBy(fn ($w) => $w->item->auction_id.'-'.$w->item->seller_profile_id)
            ->map(function ($group) use ($taxRate) {
                $first = $group->first();
                $auction = $first->item->auction;
                $seller = $first->item->sellerProfile;

                // 税抜小計（落札金額=winning_price×quantity, 手数料=買い手手数料）
                $subtotalWinning = (int) $group->sum(fn ($w) => (int) $w->winning_price * (int) $w->quantity);
                $subtotalCommission = (int) $group->sum(fn ($w) => (int) $w->commission_amount);

                // 税込（floor 丸め、PDF/精算詳細と統一）
                $salesAmount = $subtotalWinning + (int) floor($subtotalWinning * $taxRate / 100);
                $commission = $subtotalCommission + (int) floor($subtotalCommission * $taxRate / 100);
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
                ];
            })
            ->values();

        return response()->json(['success' => true, 'data' => $grouped]);
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
