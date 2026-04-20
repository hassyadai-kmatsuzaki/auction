<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\WonItem;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class WonItemController extends Controller
{
    protected $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    /**
     * 落札者管理用オークション一覧
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function auctionList(Request $request)
    {
        $query = Auction::whereIn('status', ['finished', 'live'])
            ->orderBy('event_date', 'desc');

        $auctions = $query->get()->map(function ($auction) {
            // 落札統計を取得
            $wonItems = WonItem::whereHas('item', function ($q) use ($auction) {
                $q->where('auction_id', $auction->id);
            });

            $totalCount = (clone $wonItems)->count();
            $totalAmount = (clone $wonItems)->sum('total_amount');
            
            // 入金ステータス別
            $pendingPayment = (clone $wonItems)->where('payment_status', 'pending')->count();
            $paidCount = (clone $wonItems)->where('payment_status', 'paid')->count();
            $confirmedPayment = (clone $wonItems)->where('payment_status', 'confirmed')->count();
            
            // 発送ステータス別
            $preparingCount = (clone $wonItems)->where('delivery_status', 'preparing')->count();
            $shippedCount = (clone $wonItems)->where('delivery_status', 'shipped')->count();
            $completedCount = (clone $wonItems)->where('delivery_status', 'completed')->count();

            return [
                'id' => $auction->id,
                'title' => $auction->title,
                'event_date' => $auction->event_date->format('Y-m-d'),
                'status' => $auction->status,
                'statistics' => [
                    'total_count' => $totalCount,
                    'total_amount' => $totalAmount,
                    'pending_payment' => $pendingPayment,
                    'paid_count' => $paidCount,
                    'confirmed_payment' => $confirmedPayment,
                    'preparing_count' => $preparingCount,
                    'shipped_count' => $shippedCount,
                    'completed_count' => $completedCount,
                ],
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'auctions' => $auctions,
            ],
        ]);
    }

    /**
     * オークションの落札商品一覧
     *
     * @param Request $request
     * @param int $auctionId
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request, $auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        $perPage = $request->input('per_page', 20);
        $paymentStatus = $request->input('payment_status');
        $deliveryStatus = $request->input('delivery_status');

        $query = WonItem::whereHas('item', function ($q) use ($auctionId) {
            $q->where('auction_id', $auctionId);
        })->with(['item', 'winner']);

        if ($paymentStatus && $paymentStatus !== 'all') {
            $query->where('payment_status', $paymentStatus);
        }

        if ($deliveryStatus && $deliveryStatus !== 'all') {
            $query->where('delivery_status', $deliveryStatus);
        }

        $wonItems = $query->orderBy('created_at', 'desc')->paginate($perPage);

        // 統計情報
        $allWonItems = WonItem::whereHas('item', function ($q) use ($auctionId) {
            $q->where('auction_id', $auctionId);
        });

        $stats = [
            'total_items' => (clone $allWonItems)->count(),
            'total_sales' => (clone $allWonItems)->sum('total_amount'),
            'total_shipping_fees' => (clone $allWonItems)->sum('shipping_fee'),
            'pending_count' => (clone $allWonItems)->where('payment_status', 'pending')->count(),
            'pending_amount' => (clone $allWonItems)->where('payment_status', 'pending')->sum('total_amount'),
            'paid_count' => (clone $allWonItems)->whereIn('payment_status', ['paid', 'confirmed'])->count(),
            'paid_amount' => (clone $allWonItems)->whereIn('payment_status', ['paid', 'confirmed'])->sum('total_amount'),
            'shipped_count' => (clone $allWonItems)->where('delivery_status', 'shipped')->count(),
            'completed_count' => (clone $allWonItems)->where('delivery_status', 'completed')->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'auction' => [
                    'id' => $auction->id,
                    'title' => $auction->title,
                    'event_date' => $auction->event_date->format('Y-m-d'),
                ],
                'won_items' => $wonItems->map(function ($wonItem) {
                    return [
                        'id' => $wonItem->id,
                        'item' => [
                            'id' => $wonItem->item->id,
                            'item_number' => $wonItem->item->item_number,
                            'species_name' => $wonItem->item->species_name,
                            'quantity' => $wonItem->item->quantity,
                            'thumbnail_path' => $wonItem->item->thumbnail_path,
                        ],
                        'winner' => $wonItem->winner ? [
                            'id' => $wonItem->winner->id,
                            'name' => $wonItem->winner->name,
                            'email' => $wonItem->winner->email,
                            'phone' => $wonItem->winner->phone,
                        ] : null,
                        'winning_price' => $wonItem->winning_price,
                        'quantity' => $wonItem->quantity,
                        'total_amount' => $wonItem->total_amount,
                        'commission_amount' => $wonItem->commission_amount,
                        'shipping_fee' => $wonItem->shipping_fee ?? 0,
                        'payment_status' => $wonItem->payment_status,
                        'payment_deadline' => $wonItem->payment_deadline ? $wonItem->payment_deadline->toIso8601String() : null,
                        'delivery_status' => $wonItem->delivery_status,
                        'delivery_method' => $wonItem->delivery_method,
                        'shipping_address' => $this->formatShippingAddress($wonItem),
                        'tracking_number' => $wonItem->tracking_number,
                        'shipped_at' => $wonItem->shipped_at ? $wonItem->shipped_at->toIso8601String() : null,
                        'shipping_calculated_at' => $wonItem->shipping_calculated_at ? $wonItem->shipping_calculated_at->toIso8601String() : null,
                        'created_at' => $wonItem->created_at->toIso8601String(),
                    ];
                }),
                'pagination' => [
                    'total' => $wonItems->total(),
                    'per_page' => $wonItems->perPage(),
                    'current_page' => $wonItems->currentPage(),
                    'last_page' => $wonItems->lastPage(),
                ],
                'statistics' => $stats,
            ],
        ]);
    }

    /**
     * 落札商品詳細
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show($id)
    {
        $wonItem = WonItem::with(['item.auction', 'item.media', 'winner'])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => [
                'won_item' => [
                    'id' => $wonItem->id,
                    'item' => [
                        'id' => $wonItem->item->id,
                        'item_number' => $wonItem->item->item_number,
                        'species_name' => $wonItem->item->species_name,
                        'quantity' => $wonItem->item->quantity,
                        'thumbnail_path' => $wonItem->item->thumbnail_path,
                        'inspection_info' => $wonItem->item->inspection_info,
                        'media' => $wonItem->item->media,
                        'auction' => [
                            'id' => $wonItem->item->auction->id,
                            'title' => $wonItem->item->auction->title,
                        ],
                    ],
                    'winner' => $wonItem->winner ? [
                        'id' => $wonItem->winner->id,
                        'name' => $wonItem->winner->name,
                        'email' => $wonItem->winner->email,
                        'phone' => $wonItem->winner->phone,
                        'postal_code' => $wonItem->winner->postal_code,
                        'prefecture' => $wonItem->winner->prefecture,
                        'city' => $wonItem->winner->city,
                        'address_line1' => $wonItem->winner->address_line1,
                        'address_line2' => $wonItem->winner->address_line2,
                    ] : null,
                    'winning_price' => $wonItem->winning_price,
                    'quantity' => $wonItem->quantity,
                    'total_amount' => $wonItem->total_amount,
                    'commission_rate' => $wonItem->commission_rate,
                    'commission_amount' => $wonItem->commission_amount,
                    'seller_amount' => $wonItem->seller_amount,
                    'shipping_fee' => $wonItem->shipping_fee ?? 0,
                    'shipping_breakdown' => $wonItem->shipping_breakdown,
                    'payment_status' => $wonItem->payment_status,
                    'payment_method' => $wonItem->payment_method,
                    'paid_at' => $wonItem->paid_at ? $wonItem->paid_at->toIso8601String() : null,
                    'payment_confirmed_at' => $wonItem->payment_confirmed_at ? $wonItem->payment_confirmed_at->toIso8601String() : null,
                    'payment_deadline' => $wonItem->payment_deadline ? $wonItem->payment_deadline->toIso8601String() : null,
                    'delivery_status' => $wonItem->delivery_status,
                    'delivery_method' => $wonItem->delivery_method,
                    'shipping_postal_code' => $wonItem->shipping_postal_code,
                    'shipping_prefecture' => $wonItem->shipping_prefecture,
                    'shipping_city' => $wonItem->shipping_city,
                    'shipping_address_line1' => $wonItem->shipping_address_line1,
                    'shipping_address_line2' => $wonItem->shipping_address_line2,
                    'shipping_name' => $wonItem->shipping_name,
                    'shipping_phone' => $wonItem->shipping_phone,
                    'shipping_company' => $wonItem->shipping_company,
                    'tracking_number' => $wonItem->tracking_number,
                    'shipped_at' => $wonItem->shipped_at ? $wonItem->shipped_at->toIso8601String() : null,
                    'delivered_at' => $wonItem->delivered_at ? $wonItem->delivered_at->toIso8601String() : null,
                    'notes' => $wonItem->notes,
                    'created_at' => $wonItem->created_at->toIso8601String(),
                ],
            ],
        ]);
    }

    /**
     * 入金確認
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function confirmPayment($id)
    {
        $wonItem = WonItem::findOrFail($id);

        if (!in_array($wonItem->payment_status, ['pending', 'paid'])) {
            return response()->json([
                'success' => false,
                'message' => '入金確認できない状態です。',
            ], 400);
        }

        $wonItem->update([
            'payment_status' => 'confirmed',
            'payment_confirmed_at' => now(),
            'shipping_locked_at' => now(),
            'delivery_status' => 'preparing',
        ]);

        // 通知を送信
        $wonItem->load(['item.seller', 'user']);
        $this->notificationService->sendPaymentConfirmedNotification($wonItem);
        $this->notificationService->sendSellerPaymentReceivedNotification($wonItem);

        return response()->json([
            'success' => true,
            'message' => '入金を確認しました。',
            'data' => [
                'won_item_id' => $wonItem->id,
                'payment_status' => 'confirmed',
                'payment_confirmed_at' => $wonItem->payment_confirmed_at->toIso8601String(),
            ],
        ]);
    }

    /**
     * 発送完了
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
            'tracking_number.required' => '追跡番号は必須です。',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $wonItem = WonItem::findOrFail($id);

        if ($wonItem->payment_status !== 'confirmed') {
            return response()->json([
                'success' => false,
                'message' => '入金確認後に発送してください。',
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
            'message' => '発送完了を登録しました。',
            'data' => [
                'won_item_id' => $wonItem->id,
                'delivery_status' => 'shipped',
                'tracking_number' => $wonItem->tracking_number,
                'shipped_at' => $wonItem->shipped_at->toIso8601String(),
            ],
        ]);
    }

    /**
     * 配達完了
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function complete($id)
    {
        $wonItem = WonItem::findOrFail($id);

        if ($wonItem->delivery_status !== 'shipped') {
            return response()->json([
                'success' => false,
                'message' => '発送済みの商品のみ配達完了にできます。',
            ], 400);
        }

        $wonItem->update([
            'delivery_status' => 'completed',
            'delivered_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => '配達完了を登録しました。',
            'data' => [
                'won_item_id' => $wonItem->id,
                'delivery_status' => 'completed',
                'delivered_at' => $wonItem->delivered_at->toIso8601String(),
            ],
        ]);
    }

    /**
     * メモ更新
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateNotes(Request $request, $id)
    {
        $wonItem = WonItem::findOrFail($id);

        $wonItem->update([
            'notes' => $request->input('notes'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'メモを更新しました。',
        ]);
    }

    /**
     * 管理者による送料一括計算（オークション×落札者単位）
     */
    public function calculateShipping($auctionId, $winnerId)
    {
        $wonItems = WonItem::where('winner_id', $winnerId)
            ->whereHas('item', fn ($q) => $q->where('auction_id', $auctionId))
            ->with('item')
            ->get();

        if ($wonItems->isEmpty()) {
            return response()->json(['success' => false, 'message' => '該当する落��品がありません。'], 404);
        }

        $first = $wonItems->first();
        if (!$first->shipping_prefecture) {
            return response()->json(['success' => false, 'message' => '配送先住所が未設定で���。'], 400);
        }

        try {
            $calculator = app(\App\Services\ShippingCalculatorService::class);
            $region = $calculator->getRegionByPrefecture($first->shipping_prefecture);
            if (!$region) {
                return response()->json(['success' => false, 'message' => '配送先地域を特定できません。'], 400);
            }

            $wonItems = $wonItems->values();
            $items = $wonItems->map(fn ($w) => ['quantity' => $w->item->quantity])->toArray();
            $result = $calculator->calculate($items, $region);
            $totalShippingFee = $result['total_shipping_fee'];

            $quantities = $wonItems->map(fn ($w) => $w->item->quantity)->toArray();
            $apportioned = \App\Services\ShippingCalculatorService::apportionFee($totalShippingFee, $quantities);
            foreach ($wonItems as $i => $wonItem) {
                $wonItem->update([
                    'shipping_fee' => $apportioned[$i],
                    'shipping_breakdown' => $result,
                    'shipping_calculated_at' => now(),
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => '送料を計算しました。',
                'data' => ['total_shipping_fee' => $totalShippingFee],
            ]);
        } catch (\Exception $e) {
            \Log::error('管理者送料計算エラー', ['auction_id' => $auctionId, 'winner_id' => $winnerId, 'error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => '送料の計算���失敗しました。'], 500);
        }
    }

    /**
     * 配���先住所をフォーマット
     */
    private function formatShippingAddress(WonItem $wonItem): ?string
    {
        if (!$wonItem->shipping_postal_code) {
            return null;
        }

        $address = '〒' . $wonItem->shipping_postal_code . ' ';
        $address .= $wonItem->shipping_prefecture;
        $address .= $wonItem->shipping_city;
        $address .= $wonItem->shipping_address_line1;

        if ($wonItem->shipping_address_line2) {
            $address .= ' ' . $wonItem->shipping_address_line2;
        }

        return $address;
    }
}
