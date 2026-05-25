<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Models\WonItem;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class ShippingController extends Controller
{
    protected $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }
    /**
     * 発送待ちアイテム一覧取得
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $sellerProfile = $user->sellerProfile;

        if (!$sellerProfile) {
            return response()->json([
                'success' => false,
                'message' => '出品者プロフィールが見つかりません。',
            ], 404);
        }
        
        $sellerProfileId = $sellerProfile->id;
        $status = $request->input('status'); // pending, shipped, delivered

        // 自分の出品した商品の落札情報を取得
        // 弊社預かり・弊社発送モデルのため、出品者には買受者の個人情報（氏名・住所・伝票番号）は返さない
        $query = WonItem::whereHas('item', function ($q) use ($sellerProfileId) {
            $q->where('seller_profile_id', $sellerProfileId);
        })->with(['item.auction']);

        // ステータスフィルター
        if ($status && $status !== 'all') {
            switch ($status) {
                case 'pending':
                    $query->whereIn('delivery_status', ['pending', 'preparing']);
                    break;
                case 'shipped':
                    $query->where('delivery_status', 'shipped');
                    break;
                case 'delivered':
                    $query->where('delivery_status', 'completed');
                    break;
            }
        }

        $items = $query->orderBy('created_at', 'desc')->get();

        // 統計
        $allItems = WonItem::whereHas('item', function ($q) use ($sellerProfileId) {
            $q->where('seller_profile_id', $sellerProfileId);
        });

        $stats = [
            'pending' => (clone $allItems)->whereIn('delivery_status', ['pending', 'preparing'])->count(),
            'shipped' => (clone $allItems)->where('delivery_status', 'shipped')->count(),
            'delivered' => (clone $allItems)->where('delivery_status', 'completed')->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items->map(function ($wonItem) {
                    return [
                        'id' => $wonItem->id,
                        'item' => [
                            'id' => $wonItem->item->id,
                            'item_number' => $wonItem->item->item_number,
                            'exhibit_code' => $wonItem->item->exhibit_code,
                            'species_name' => $wonItem->item->species_name,
                            'quantity' => $wonItem->item->quantity,
                            'thumbnail_path' => $wonItem->item->thumbnail_path,
                        ],
                        'auction' => [
                            'id' => $wonItem->item->auction->id,
                            'title' => $wonItem->item->auction->title,
                        ],
                        'price' => $wonItem->winning_price,
                        'total_amount' => $wonItem->total_amount,
                        'shipping_fee' => $wonItem->shipping_fee ?? 0,
                        'payment_status' => $wonItem->payment_status,
                        'delivery_status' => $this->mapDeliveryStatus($wonItem->delivery_status),
                        'sold_at' => $wonItem->created_at->toIso8601String(),
                        'shipped_at' => $wonItem->shipped_at ? $wonItem->shipped_at->toIso8601String() : null,
                        'delivered_at' => $wonItem->delivered_at ? $wonItem->delivered_at->toIso8601String() : null,
                    ];
                }),
                'statistics' => $stats,
            ],
        ]);
    }

    /**
     * 発送情報を登録
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function ship(Request $request, $id)
    {

        $validator = Validator::make($request->all(), [
            'shipping_company' => 'required|string|max:100',
            'tracking_number' => 'required|string|max:100',
        ], [
            'shipping_company.required' => '配送業者は必須です。',
            'tracking_number.required' => '伝票番号は必須です。',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $sellerProfile = Auth::user()->sellerProfile;
        if (!$sellerProfile) {
            return response()->json([
                'success' => false,
                'message' => '出品者プロフィールが見つかりません。',
            ], 404);
        }
        
        $wonItem = WonItem::whereHas('item', function ($q) use ($sellerProfile) {
            $q->where('seller_profile_id', $sellerProfile->id);
        })->findOrFail($id);

        $now = now();
        $update = [
            'delivery_status' => 'shipped',
            'shipping_company' => $request->shipping_company,
            'tracking_number' => $request->tracking_number,
            'shipped_at' => $now,
        ];
        if (is_null($wonItem->shipping_locked_at)) {
            $update['shipping_locked_at'] = $now;
        }
        $wonItem->update($update);

        // 発送通知を送信
        $wonItem->load('user');
        $this->notificationService->sendShippingNotification($wonItem);

        return response()->json([
            'success' => true,
            'message' => '発送情報を登録しました。',
            'data' => [
                'id' => $wonItem->id,
                'delivery_status' => 'shipped',
                'tracking_number' => $wonItem->tracking_number,
                'shipped_at' => $wonItem->shipped_at->toIso8601String(),
            ],
        ]);
    }

    /**
     * 伝票番号を更新
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateTracking(Request $request, $id)
    {

        $validator = Validator::make($request->all(), [
            'shipping_company' => 'required|string|max:100',
            'tracking_number' => 'required|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $sellerProfile = Auth::user()->sellerProfile;
        if (!$sellerProfile) {
            return response()->json([
                'success' => false,
                'message' => '出品者プロフィールが見つかりません。',
            ], 404);
        }
        
        $wonItem = WonItem::whereHas('item', function ($q) use ($sellerProfile) {
            $q->where('seller_profile_id', $sellerProfile->id);
        })->findOrFail($id);

        $wonItem->update([
            'shipping_company' => $request->shipping_company,
            'tracking_number' => $request->tracking_number,
        ]);

        return response()->json([
            'success' => true,
            'message' => '伝票番号を更新しました。',
        ]);
    }

    /**
     * 配送ステータスをマッピング
     */
    private function mapDeliveryStatus(string $status): string
    {
        return match ($status) {
            'pending', 'preparing' => 'pending',
            'shipped' => 'shipped',
            'completed' => 'delivered',
            default => $status,
        };
    }
}
