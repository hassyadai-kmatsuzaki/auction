<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\AuctionSellerShipment;
use App\Models\SellerProfile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ShipmentController extends Controller
{
    /**
     * 出品者が当該オークションへ発送した伝票番号を一括登録（既存分は置き換え）。
     */
    public function bulkUpsert(Request $request, $auctionId)
    {
        $validator = Validator::make($request->all(), [
            'shipments' => 'required|array|min:1|max:10',
            'shipments.*.carrier' => 'required|in:' . implode(',', AuctionSellerShipment::CARRIERS),
            'shipments.*.tracking_number' => 'required|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $auction = Auction::find($auctionId);
        if (!$auction) {
            return response()->json([
                'success' => false,
                'message' => 'オークションが見つかりません。',
            ], 404);
        }

        $user = Auth::user();
        $sellerProfile = SellerProfile::where('user_id', $user->id)->first();
        if (!$sellerProfile) {
            return response()->json([
                'success' => false,
                'message' => '出品者情報が見つかりません。',
            ], 404);
        }

        $shipments = $request->input('shipments', []);

        DB::transaction(function () use ($auction, $sellerProfile, $shipments) {
            // 既存の自分の伝票を全削除して入れ替え（同一伝票の重複登録を避ける）
            AuctionSellerShipment::where('auction_id', $auction->id)
                ->where('seller_profile_id', $sellerProfile->id)
                ->delete();

            $seen = [];
            foreach ($shipments as $s) {
                $key = $s['carrier'] . ':' . trim($s['tracking_number']);
                if (isset($seen[$key])) continue;
                $seen[$key] = true;

                AuctionSellerShipment::create([
                    'auction_id' => $auction->id,
                    'seller_profile_id' => $sellerProfile->id,
                    'carrier' => $s['carrier'],
                    'tracking_number' => trim($s['tracking_number']),
                ]);
            }
        });

        return response()->json([
            'success' => true,
            'message' => '伝票番号を登録しました。',
        ]);
    }
}
