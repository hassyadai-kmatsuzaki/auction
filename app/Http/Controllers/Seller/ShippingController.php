<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Models\WonItem;
use App\Services\NotificationService;
use App\Services\TestModeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class ShippingController extends Controller
{
    protected $notificationService;
    protected TestModeService $testMode;

    public function __construct(NotificationService $notificationService, TestModeService $testMode)
    {
        $this->notificationService = $notificationService;
        $this->testMode = $testMode;
    }

    private function blockedByTestMode(): bool
    {
        return $this->testMode->isEnabled() && !$this->testMode->currentUserCanSeeTestUniverse(Auth::user());
    }
    /**
     * 発送待ちアイテム一覧取得
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        if ($this->blockedByTestMode()) {
            return response()->json(['success' => true, 'data' => ['items' => []]]);
        }

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
        $query = WonItem::whereHas('item', function ($q) use ($sellerProfileId) {
            $q->where('seller_profile_id', $sellerProfileId);
        })->with(['item.auction', 'winner']);

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
                            'species_name' => $wonItem->item->species_name,
                            'quantity' => $wonItem->item->quantity,
                            'thumbnail_path' => $wonItem->item->thumbnail_path,
                        ],
                        'auction' => [
                            'id' => $wonItem->item->auction->id,
                            'title' => $wonItem->item->auction->title,
                        ],
                        'buyer' => $wonItem->winner ? [
                            'id' => $wonItem->winner->id,
                            'name' => $wonItem->winner->name,
                            'address' => $this->formatAddress($wonItem),
                        ] : null,
                        'price' => $wonItem->winning_price,
                        'total_amount' => $wonItem->total_amount,
                        'shipping_fee' => $wonItem->shipping_fee ?? 0,
                        'payment_status' => $wonItem->payment_status,
                        'delivery_status' => $this->mapDeliveryStatus($wonItem->delivery_status),
                        'tracking_number' => $wonItem->tracking_number,
                        'shipping_company' => $wonItem->shipping_company,
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
        if ($this->blockedByTestMode()) {
            return response()->json(['success' => false, 'message' => '現在テスト運用中のため、発送操作は受け付けられません。'], 403);
        }

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

        // 入金確認済みか確認
        if (!in_array($wonItem->payment_status, ['paid', 'confirmed'])) {
            return response()->json([
                'success' => false,
                'message' => '入金確認後に発送登録してください。',
            ], 400);
        }

        $wonItem->update([
            'delivery_status' => 'shipped',
            'shipping_company' => $request->shipping_company,
            'tracking_number' => $request->tracking_number,
            'shipped_at' => now(),
        ]);

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
        if ($this->blockedByTestMode()) {
            return response()->json(['success' => false, 'message' => '現在テスト運用中のため、操作は受け付けられません。'], 403);
        }

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
     * 住所をフォーマット
     */
    private function formatAddress(WonItem $wonItem): string
    {
        // 配送先住所が設定されている場合はそちらを使用
        if ($wonItem->shipping_postal_code) {
            $address = $wonItem->shipping_prefecture;
            $address .= $wonItem->shipping_city;
            $address .= $wonItem->shipping_address_line1;
            if ($wonItem->shipping_address_line2) {
                $address .= ' ' . $wonItem->shipping_address_line2;
            }
            return $address;
        }

        // 落札者の住所を使用
        if ($wonItem->winner) {
            $address = $wonItem->winner->prefecture ?? '';
            $address .= $wonItem->winner->city ?? '';
            $address .= $wonItem->winner->address_line1 ?? '';
            if ($wonItem->winner->address_line2) {
                $address .= ' ' . $wonItem->winner->address_line2;
            }
            return $address ?: '住所未登録';
        }

        return '住所未登録';
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
