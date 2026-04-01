<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use App\Models\WonItem;
use App\Services\ShippingCalculatorService;
use App\Traits\MediaUrlTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class WonItemController extends Controller
{
    use MediaUrlTrait;

    /**
     * 自分の落札商品一覧を取得
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $userId = Auth::id();

        $wonItems = WonItem::forWinner($userId)
            ->with(['item.auction', 'item.media'])
            ->orderBy('created_at', 'desc')
            ->get();

        // 合計金額を計算
        $totalAmount = $wonItems->sum('total_amount');
        $pendingAmount = $wonItems->where('payment_status', 'pending')->sum('total_amount');
        $paidAmount = $wonItems->whereIn('payment_status', ['paid', 'confirmed'])->sum('total_amount');
        $totalShippingFee = $wonItems->sum(fn ($w) => $w->shipping_fee ?? 0);

        // オークション別にグルーピング
        $grouped = $wonItems->groupBy(fn ($wonItem) => $wonItem->item?->auction?->id ?? 0);

        $auctions = $grouped->map(function ($items, $auctionId) {
            $auction = $items->first()->item?->auction;
            $auctionTotalAmount = $items->sum('total_amount');
            $auctionShippingFee = $items->sum(fn ($w) => $w->shipping_fee ?? 0);
            $allPaid = $items->every(fn ($w) => in_array($w->payment_status, ['paid', 'confirmed']));
            $anyPending = $items->contains(fn ($w) => $w->payment_status === 'pending');
            $canUpdateAddress = $items->every(fn ($w) => $w->canUpdateShippingAddress());

            // 代表の配送先（最初の落札品から）
            $first = $items->first();

            return [
                'auction' => $auction ? [
                    'id' => $auction->id,
                    'title' => $auction->title,
                    'event_date' => $auction->event_date->format('Y-m-d'),
                ] : null,
                'summary' => [
                    'item_count' => $items->count(),
                    'total_amount' => $auctionTotalAmount,
                    'shipping_fee' => $auctionShippingFee,
                    'grand_total' => $auctionTotalAmount + $auctionShippingFee,
                    'all_paid' => $allPaid,
                    'any_pending' => $anyPending,
                ],
                'shipping' => [
                    'address' => $this->formatShippingAddress($first),
                    'can_update' => $canUpdateAddress,
                ],
                'won_items' => $items->map(function ($wonItem) {
                    $item = $wonItem->item;

                    return [
                        'id' => $wonItem->id,
                        'item' => $item ? [
                            'id' => $item->id,
                            'item_number' => $item->item_number,
                            'species_name' => $item->species_name,
                            'quantity' => $item->quantity,
                            'thumbnail_path' => $item->thumbnail_path,
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
                        'shipping_company' => $wonItem->shipping_company,
                        'tracking_number' => $wonItem->tracking_number,
                        'shipped_at' => $wonItem->shipped_at ? $wonItem->shipped_at->toIso8601String() : null,
                        'created_at' => $wonItem->created_at->toIso8601String(),
                    ];
                })->values(),
            ];
        })->sortByDesc(fn ($g) => $g['auction']['event_date'] ?? '')->values();

        return response()->json([
            'success' => true,
            'data' => [
                'auctions' => $auctions,
                'summary' => [
                    'total_amount' => $totalAmount,
                    'pending_amount' => $pendingAmount,
                    'paid_amount' => $paidAmount,
                    'shipping_fee' => $totalShippingFee,
                    'item_count' => $wonItems->count(),
                    'auction_count' => $auctions->count(),
                ],
            ],
        ]);
    }

    /**
     * 落札商品詳細を取得
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show($id)
    {
        $userId = Auth::id();
        
        $wonItem = WonItem::forWinner($userId)
            ->with(['item.auction', 'item.media'])
            ->findOrFail($id);
        
        $item = $wonItem->item;
        $auction = $item?->auction;

        return response()->json([
            'success' => true,
            'data' => [
                'won_item' => [
                    'id' => $wonItem->id,
                    'item' => $item ? [
                        'id' => $item->id,
                        'item_number' => $item->item_number,
                        'species_name' => $item->species_name,
                        'quantity' => $item->quantity,
                        'thumbnail_path' => $item->thumbnail_path,
                        'inspection_info' => $item->inspection_info,
                        'individual_info' => $item->individual_info,
                        'notes' => $item->notes,
                        'media' => $this->transformMedia($item->media),
                        'auction' => $auction ? [
                            'id' => $auction->id,
                            'title' => $auction->title,
                            'event_date' => $auction->event_date->format('Y-m-d'),
                        ] : null,
                    ] : null,
                    'winning_price' => $wonItem->winning_price,
                    'quantity' => $wonItem->quantity,
                    'total_amount' => $wonItem->total_amount,
                    'commission_rate' => $wonItem->commission_rate,
                    'commission_amount' => $wonItem->commission_amount,
                    'shipping_fee' => $wonItem->shipping_fee ?? 0,
                    'shipping_breakdown' => $wonItem->shipping_breakdown,
                    'payment_status' => $wonItem->payment_status,
                    'payment_method' => $wonItem->payment_method,
                    'payment_deadline' => $wonItem->payment_deadline ? $wonItem->payment_deadline->toIso8601String() : null,
                    'paid_at' => $wonItem->paid_at ? $wonItem->paid_at->toIso8601String() : null,
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
                    'can_update_address' => $wonItem->canUpdateShippingAddress(),
                    'notes' => $wonItem->notes,
                    'created_at' => $wonItem->created_at->toIso8601String(),
                ],
            ],
        ]);
    }

    /**
     * オークション内全落札品の配送先住所を一括更新
     *
     * @param Request $request
     * @param int $auctionId
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateAddress(Request $request, $auctionId)
    {
        $userId = Auth::id();

        // このオークションの自分の落札品を全取得
        $wonItems = WonItem::forWinner($userId)
            ->whereHas('item', fn ($q) => $q->where('auction_id', $auctionId))
            ->with('item')
            ->get();

        if ($wonItems->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => '該当する落札品がありません。',
            ], 404);
        }

        // 全品が変更可能かチェック
        $lockedItems = $wonItems->filter(fn ($w) => !$w->canUpdateShippingAddress());
        if ($lockedItems->isNotEmpty()) {
            return response()->json([
                'success' => false,
                'message' => '入金確認後は配送先を変更できません。',
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'shipping_postal_code' => 'required|string|max:10',
            'shipping_prefecture' => 'required|string|max:50',
            'shipping_city' => 'required|string|max:100',
            'shipping_address_line1' => 'required|string|max:255',
            'shipping_address_line2' => 'nullable|string|max:255',
            'shipping_name' => 'required|string|max:255',
            'shipping_phone' => 'required|string|max:20',
        ], [
            'shipping_postal_code.required' => '郵便番号は必須です。',
            'shipping_prefecture.required' => '都道府県は必須です。',
            'shipping_city.required' => '市区町村は必須です。',
            'shipping_address_line1.required' => '番地は必須です。',
            'shipping_name.required' => '受取人氏名は必須です。',
            'shipping_phone.required' => '電話番号は必須です。',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $addressData = [
            'shipping_postal_code' => $request->shipping_postal_code,
            'shipping_prefecture' => $request->shipping_prefecture,
            'shipping_city' => $request->shipping_city,
            'shipping_address_line1' => $request->shipping_address_line1,
            'shipping_address_line2' => $request->shipping_address_line2,
            'shipping_name' => $request->shipping_name,
            'shipping_phone' => $request->shipping_phone,
        ];

        $totalShippingFee = 0;

        // 各落札品の配送先を更新し、配送料を再計算
        foreach ($wonItems as $wonItem) {
            $updateData = $addressData;

            try {
                $calculator = app(ShippingCalculatorService::class);
                $region = $calculator->getRegionByPrefecture($request->shipping_prefecture);
                if ($region) {
                    $result = $calculator->calculate(
                        [['quantity' => $wonItem->item->quantity]],
                        $region
                    );
                    $updateData['shipping_fee'] = $result['total_shipping_fee'];
                    $updateData['shipping_breakdown'] = $result;
                    $totalShippingFee += $result['total_shipping_fee'];
                }
            } catch (\Exception $e) {
                \Log::warning('配送料金の自動計算に失敗', [
                    'won_item_id' => $wonItem->id,
                    'error' => $e->getMessage(),
                ]);
            }

            $wonItem->update($updateData);
        }

        return response()->json([
            'success' => true,
            'message' => '配送先を更新しました。',
            'data' => [
                'shipping_address' => $this->formatShippingAddress($wonItems->first()),
                'total_shipping_fee' => $totalShippingFee,
                'updated_count' => $wonItems->count(),
            ],
        ]);
    }

    /**
     * 配送先住所をフォーマット
     *
     * @param WonItem $wonItem
     * @return string|null
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
