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
    public const MAX_SHIPMENTS_PER_SELLER = 10;

    /**
     * 自分が当該オークションに登録済みの伝票一覧を返す。
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

        $sellerProfile = SellerProfile::where('user_id', Auth::id())->first();
        if (!$sellerProfile) {
            return response()->json([
                'success' => true,
                'data' => ['shipments' => [], 'remaining_slots' => self::MAX_SHIPMENTS_PER_SELLER],
            ]);
        }

        $shipments = AuctionSellerShipment::where('auction_id', $auction->id)
            ->where('seller_profile_id', $sellerProfile->id)
            ->orderBy('created_at')
            ->get(['id', 'carrier', 'tracking_number', 'created_at']);

        return response()->json([
            'success' => true,
            'data' => [
                'shipments' => $shipments->map(fn ($s) => [
                    'id' => $s->id,
                    'carrier' => $s->carrier,
                    'carrier_label' => AuctionSellerShipment::CARRIER_LABELS[$s->carrier] ?? $s->carrier,
                    'tracking_number' => $s->tracking_number,
                ])->values(),
                'remaining_slots' => max(0, self::MAX_SHIPMENTS_PER_SELLER - $shipments->count()),
            ],
        ]);
    }

    /**
     * 当該オークションに新たな伝票番号を追加登録する（既存伝票は保持）。
     * 同一 (carrier, tracking_number) は UNIQUE 制約により黙殺。
     * 既存 + 新規が 10 件を超える場合は 422 を返す。
     */
    public function bulkUpsert(Request $request, $auctionId)
    {
        $validator = Validator::make($request->all(), [
            'shipments' => 'required|array|min:1|max:' . self::MAX_SHIPMENTS_PER_SELLER,
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
            // 既存件数 + 新規件数（リクエスト内重複と既存重複を除外後）が上限を超えないか先に確認。
            $existing = AuctionSellerShipment::where('auction_id', $auction->id)
                ->where('seller_profile_id', $sellerProfile->id)
                ->get(['carrier', 'tracking_number']);

            $existingKeys = $existing->mapWithKeys(fn ($r) => [
                $r->carrier . ':' . $r->tracking_number => true,
            ])->all();

            $toInsert = [];
            foreach ($shipments as $s) {
                $key = $s['carrier'] . ':' . trim($s['tracking_number']);
                if (isset($existingKeys[$key])) continue; // 既存と重複は黙殺
                if (isset($toInsert[$key])) continue;     // リクエスト内重複も黙殺
                $toInsert[$key] = [
                    'auction_id' => $auction->id,
                    'seller_profile_id' => $sellerProfile->id,
                    'carrier' => $s['carrier'],
                    'tracking_number' => trim($s['tracking_number']),
                ];
            }

            $totalAfter = $existing->count() + count($toInsert);
            if ($totalAfter > self::MAX_SHIPMENTS_PER_SELLER) {
                abort(response()->json([
                    'success' => false,
                    'message' => '伝票番号は1オークションあたり最大' . self::MAX_SHIPMENTS_PER_SELLER . '件までです。'
                        . '既に' . $existing->count() . '件登録されています。',
                ], 422));
            }

            foreach ($toInsert as $row) {
                AuctionSellerShipment::create($row);
            }
        });

        return response()->json([
            'success' => true,
            'message' => '伝票番号を登録しました。',
        ]);
    }
}
