<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\AuctionSellerShipment;

class ShipmentController extends Controller
{
    /**
     * オークションの出品者別伝票番号一覧。
     */
    public function index($auctionId)
    {
        $auction = Auction::find($auctionId);
        if (!$auction) {
            return response()->json([
                'success' => false,
                'message' => 'オークションが見つかりません。',
            ], 404);
        }

        $shipments = AuctionSellerShipment::where('auction_id', $auction->id)
            ->with(['sellerProfile:id,seller_code,seller_name'])
            ->orderBy('seller_profile_id')
            ->orderBy('created_at')
            ->get();

        $grouped = $shipments->groupBy('seller_profile_id')->map(function ($rows) {
            $first = $rows->first();
            return [
                'seller' => $first->sellerProfile ? [
                    'id' => $first->sellerProfile->id,
                    'seller_code' => $first->sellerProfile->seller_code,
                    'seller_name' => $first->sellerProfile->seller_name,
                ] : null,
                'shipments' => $rows->map(fn ($r) => [
                    'id' => $r->id,
                    'carrier' => $r->carrier,
                    'carrier_label' => AuctionSellerShipment::CARRIER_LABELS[$r->carrier] ?? $r->carrier,
                    'tracking_number' => $r->tracking_number,
                    'created_at' => $r->created_at?->format('Y-m-d H:i'),
                ])->values(),
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => [
                'sellers' => $grouped,
                'total' => $shipments->count(),
            ],
        ]);
    }
}
