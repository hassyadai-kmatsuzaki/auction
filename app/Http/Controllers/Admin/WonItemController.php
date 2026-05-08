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

        $perPage = $request->input('per_page', 200);
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
                        'shipping_approved_at' => $wonItem->shipping_approved_at ? $wonItem->shipping_approved_at->toIso8601String() : null,
                        'calculation_mode' => $wonItem->calculation_mode,
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
     * 入金確認（同一オークション×同一落札者の全 WonItem にまとめて適用）
     */
    public function confirmPayment($id)
    {
        $wonItem = WonItem::with('item')->findOrFail($id);
        $group = $this->findGroupItems($wonItem);

        $targets = $group->whereIn('payment_status', ['pending', 'paid']);
        if ($targets->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => '入金確認できる商品がこの落札者にありません。',
            ], 400);
        }

        $now = now();
        $ids = $targets->pluck('id');

        WonItem::whereIn('id', $ids)->update([
            'payment_status' => 'confirmed',
            'payment_confirmed_at' => $now,
        ]);

        WonItem::whereIn('id', $ids)
            ->whereNull('shipping_locked_at')
            ->update(['shipping_locked_at' => $now]);

        // 発送先行で既に shipped/completed の場合は巻き戻さない
        WonItem::whereIn('id', $ids)
            ->where('delivery_status', 'pending')
            ->update(['delivery_status' => 'preparing']);

        // 落札者通知は代表1件で1回、出品者通知は出品者ごとに1回。
        $representative = WonItem::with(['item.seller', 'user'])->find($wonItem->id);
        $this->notificationService->sendPaymentConfirmedNotification($representative);

        $bySeller = WonItem::with(['item.seller', 'user'])
            ->whereIn('id', $ids)
            ->get()
            ->groupBy(fn ($w) => $w->item->seller_profile_id);
        foreach ($bySeller as $items) {
            $this->notificationService->sendSellerPaymentReceivedNotification($items->first());
        }

        return response()->json([
            'success' => true,
            'message' => '入金を確認しました。',
            'data' => [
                'affected_count' => $targets->count(),
                'payment_status' => 'confirmed',
                'payment_confirmed_at' => $now->toIso8601String(),
            ],
        ]);
    }

    /**
     * 発送登録（同一オークション×同一落札者の全 WonItem に同じ伝票番号を適用）
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

        $wonItem = WonItem::with('item')->findOrFail($id);
        $group = $this->findGroupItems($wonItem);

        // 送料未承認の発送を禁止（引き取り＝送料0円も承認済みなら通る）
        if ($group->contains(fn ($w) => $w->shipping_approved_at === null)) {
            return response()->json([
                'success' => false,
                'message' => '送料が未承認です。先に送料承認を行ってください。',
            ], 409);
        }

        $now = now();
        $groupIds = $group->pluck('id');

        WonItem::whereIn('id', $groupIds)->update([
            'delivery_status' => 'shipped',
            'shipping_company' => $request->shipping_company,
            'tracking_number' => $request->tracking_number,
            'shipped_at' => $now,
        ]);

        // 発送が先行する場合に備え、未ロックなら配送先をここでロック
        WonItem::whereIn('id', $groupIds)
            ->whereNull('shipping_locked_at')
            ->update(['shipping_locked_at' => $now]);

        $representative = WonItem::with('user')->find($wonItem->id);
        $this->notificationService->sendShippingNotification($representative);

        return response()->json([
            'success' => true,
            'message' => '発送完了を登録しました。',
            'data' => [
                'affected_count' => $group->count(),
                'delivery_status' => 'shipped',
                'tracking_number' => $request->tracking_number,
                'shipped_at' => $now->toIso8601String(),
            ],
        ]);
    }

    /**
     * 配達完了（同一オークション×同一落札者の全 WonItem にまとめて適用）
     */
    public function complete($id)
    {
        $wonItem = WonItem::with('item')->findOrFail($id);
        $group = $this->findGroupItems($wonItem);

        if ($group->contains(fn ($w) => $w->delivery_status !== 'shipped')) {
            return response()->json([
                'success' => false,
                'message' => '発送済みの商品のみ配達完了にできます。',
            ], 400);
        }

        $now = now();
        WonItem::whereIn('id', $group->pluck('id'))->update([
            'delivery_status' => 'completed',
            'delivered_at' => $now,
        ]);

        return response()->json([
            'success' => true,
            'message' => '配達完了を登録しました。',
            'data' => [
                'affected_count' => $group->count(),
                'delivery_status' => 'completed',
                'delivered_at' => $now->toIso8601String(),
            ],
        ]);
    }

    /**
     * 同一 (auction, winner) に属する WonItem を取得する。
     */
    private function findGroupItems(WonItem $wonItem)
    {
        return WonItem::with('item')
            ->where('winner_id', $wonItem->winner_id)
            ->whereHas('item', fn ($q) => $q->where('auction_id', $wonItem->item->auction_id))
            ->get();
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
    public function calculateShipping(Request $request, $auctionId, $winnerId)
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

            // 既に管理者承認済みの場合は再計算を拒否（誤って上書きさせない）
            if ($wonItems->contains(fn ($w) => $w->shipping_approved_at !== null)) {
                return response()->json([
                    'success' => false,
                    'message' => 'この落札者の送料は既に承認済みです。再計算するには先に承認を取り消してください。',
                ], 409);
            }

            $wonItems = $wonItems->values();
            $items = $wonItems->map(fn ($w) => [
                'quantity' => $w->item->quantity,
                'species_type_id' => $w->item->species_type_id,
            ])->toArray();
            $result = $calculator->calculate($items, $region);
            $mode = $result['calculation_mode'] ?? 'auto';

            if ($mode === 'manual') {
                foreach ($wonItems as $wonItem) {
                    $wonItem->update([
                        'shipping_fee' => 0,
                        'shipping_fee_auto' => null,
                        'shipping_breakdown' => $result,
                        'calculation_mode' => 'manual',
                        'shipping_calculated_at' => now(),
                    ]);
                }
                return response()->json([
                    'success' => true,
                    'message' => '「その他」種別を含むため、送料の手動入力が必要です。承認画面で金額を確定してください。',
                    'data' => ['calculation_mode' => 'manual', 'total_shipping_fee' => null],
                ]);
            }

            $totalShippingFee = $result['total_shipping_fee'];
            $quantities = $wonItems->map(fn ($w) => $w->item->quantity)->toArray();
            $apportioned = \App\Services\ShippingCalculatorService::apportionFee($totalShippingFee, $quantities);
            $now = now();
            $adminId = $request->user()->id;
            foreach ($wonItems as $i => $wonItem) {
                $wonItem->update([
                    'shipping_fee' => $apportioned[$i],
                    'shipping_fee_auto' => $apportioned[$i],
                    'shipping_breakdown' => $result,
                    'calculation_mode' => $mode,
                    'shipping_calculated_at' => $now,
                    // 自動計算種別のみの場合は管理者承認を省略し即時確定
                    'shipping_approved_at' => $now,
                    'shipping_approved_by' => $adminId,
                    'shipping_adjustment_reason' => null,
                ]);
            }

            // 落札者に送料確定を通知
            $refreshed = $wonItems->fresh(['user', 'item']);
            app(\App\Services\NotificationService::class)
                ->sendShippingFeeFinalizedNotification($refreshed);

            return response()->json([
                'success' => true,
                'message' => '送料を計算しました。',
                'data' => ['calculation_mode' => $mode, 'total_shipping_fee' => $totalShippingFee],
            ]);
        } catch (\Exception $e) {
            \Log::error('管理者送料計算エラー', ['auction_id' => $auctionId, 'winner_id' => $winnerId, 'error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => '送料の計算���失敗しました。'], 500);
        }
    }

    /**
     * 管理者による送料の手動入力＆確定
     *
     * 「その他」種別を含む発送単位（calculation_mode = manual）の送料を確定するエンドポイント。
     * shipping_fee を必須で受け取り、落札者ごとの数量比で按分する。
     * 0円で確定する場合は adjustment_reason（送料無料の根拠）が必須。
     * 自動計算種別のみの発送単位は calculateShipping 内で即時確定される。
     */
    public function approveShipping(Request $request, $auctionId, $winnerId)
    {
        $validator = Validator::make($request->all(), [
            'shipping_fee' => 'required|integer|min:0|max:1000000',
            'adjustment_reason' => 'nullable|string|max:500',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $overrideFee = (int) $request->input('shipping_fee');
        $reason = $request->input('adjustment_reason');

        if ($overrideFee === 0 && empty(trim((string) $reason))) {
            return response()->json([
                'success' => false,
                'message' => '送料0円で確定する場合は理由（送料無料の根拠等）が必須です。',
            ], 422);
        }

        $wonItems = WonItem::where('winner_id', $winnerId)
            ->whereHas('item', fn ($q) => $q->where('auction_id', $auctionId))
            ->get();

        if ($wonItems->isEmpty()) {
            return response()->json(['success' => false, 'message' => '該当する落札品がありません。'], 404);
        }

        if ($wonItems->contains(fn ($w) => $w->shipping_calculated_at === null)) {
            return response()->json(['success' => false, 'message' => '送料が未計算です。先に送料計算を実行してください。'], 409);
        }

        $adminId = $request->user()->id;

        \DB::transaction(function () use ($wonItems, $overrideFee, $reason, $adminId) {
            $quantities = $wonItems->map(fn ($w) => $w->item->quantity ?? 1)->toArray();
            $apportioned = \App\Services\ShippingCalculatorService::apportionFee($overrideFee, $quantities);
            foreach ($wonItems->values() as $i => $w) {
                $w->update([
                    'shipping_fee' => $apportioned[$i],
                    'shipping_approved_at' => now(),
                    'shipping_approved_by' => $adminId,
                    'shipping_adjustment_reason' => $reason,
                ]);
            }
        });

        // 落札者に送料確定を通知（Mail + LINE、通知設定でゲート）
        $refreshed = $wonItems->fresh(['user', 'item']);
        app(\App\Services\NotificationService::class)
            ->sendShippingFeeFinalizedNotification($refreshed);

        return response()->json([
            'success' => true,
            'message' => '送料を確定しました。',
        ]);
    }

    /**
     * 「その他」等 manual 種別の送料を管理者が手動入力して確定する。
     *
     * POST /admin/auctions/{auctionId}/winners/{winnerId}/manual-shipping-fee
     * body: { shipping_fee: int, adjustment_reason?: string }
     *
     * shipping_calculated_at がセットされ、shipping_approved_at も即時セット、
     * 落札者へ送料確定通知が送信される。
     */
    public function setManualShippingFee(Request $request, $auctionId, $winnerId)
    {
        $validator = Validator::make($request->all(), [
            'shipping_fee' => 'required|integer|min:0|max:1000000',
            'adjustment_reason' => 'nullable|string|max:500',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $wonItems = WonItem::where('winner_id', $winnerId)
            ->whereHas('item', fn ($q) => $q->where('auction_id', $auctionId))
            ->with('item')
            ->get();

        if ($wonItems->isEmpty()) {
            return response()->json(['success' => false, 'message' => '該当する落札品がありません。'], 404);
        }

        if ($wonItems->contains(fn ($w) => $w->shipping_approved_at !== null)) {
            return response()->json([
                'success' => false,
                'message' => 'この落札者の送料は既に承認済みです。',
            ], 409);
        }

        $totalFee = (int) $request->input('shipping_fee');
        $reason = $request->input('adjustment_reason');
        $adminId = $request->user()->id;
        $quantities = $wonItems->map(fn ($w) => $w->item->quantity ?? 1)->toArray();
        $apportioned = \App\Services\ShippingCalculatorService::apportionFee($totalFee, $quantities);

        \DB::transaction(function () use ($wonItems, $apportioned, $reason, $adminId) {
            foreach ($wonItems->values() as $i => $w) {
                $w->update([
                    'shipping_fee' => $apportioned[$i],
                    'shipping_fee_auto' => null,
                    'calculation_mode' => 'manual',
                    'shipping_calculated_at' => now(),
                    'shipping_approved_at' => now(),
                    'shipping_approved_by' => $adminId,
                    'shipping_adjustment_reason' => $reason,
                ]);
            }
        });

        $refreshed = $wonItems->fresh(['user', 'item']);
        app(\App\Services\NotificationService::class)
            ->sendShippingFeeFinalizedNotification($refreshed);

        return response()->json([
            'success' => true,
            'message' => '手動送料を確定し、落札者に通知しました。',
            'data' => ['total_shipping_fee' => $totalFee],
        ]);
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
