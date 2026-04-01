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
        $auctionId = $request->input('auction_id');
        
        $query = WonItem::forWinner($userId)
            ->with(['item.auction', 'item.media']);
        
        if ($auctionId) {
            $query->whereHas('item', function ($q) use ($auctionId) {
                $q->where('auction_id', $auctionId);
            });
        }
        
        $wonItems = $query->orderBy('created_at', 'desc')->get();
        
        // 合計金額を計算
        $totalAmount = $wonItems->sum('total_amount');
        $pendingAmount = $wonItems->where('payment_status', 'pending')->sum('total_amount');
        $paidAmount = $wonItems->whereIn('payment_status', ['paid', 'confirmed'])->sum('total_amount');
        
        return response()->json([
            'success' => true,
            'data' => [
                'won_items' => $wonItems->map(function ($wonItem) {
                    $item = $wonItem->item;
                    $auction = $item?->auction;

                    return [
                        'id' => $wonItem->id,
                        'item' => $item ? [
                            'id' => $item->id,
                            'item_number' => $item->item_number,
                            'species_name' => $item->species_name,
                            'quantity' => $item->quantity,
                            'thumbnail_path' => $item->thumbnail_path,
                            'inspection_info' => $item->inspection_info,
                            'individual_info' => $item->individual_info,
                            'auction' => $auction ? [
                                'id' => $auction->id,
                                'title' => $auction->title,
                                'event_date' => $auction->event_date->format('Y-m-d'),
                            ] : null,
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
                }),
                'summary' => [
                    'total_amount' => $totalAmount,
                    'pending_amount' => $pendingAmount,
                    'paid_amount' => $paidAmount,
                    'item_count' => $wonItems->count(),
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
     * 配送先住所を更新
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateAddress(Request $request, $id)
    {
        $userId = Auth::id();
        
        $wonItem = WonItem::forWinner($userId)->findOrFail($id);
        
        // 配送先変更可能かチェック
        if (!$wonItem->canUpdateShippingAddress()) {
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
        
        $updateData = [
            'shipping_postal_code' => $request->shipping_postal_code,
            'shipping_prefecture' => $request->shipping_prefecture,
            'shipping_city' => $request->shipping_city,
            'shipping_address_line1' => $request->shipping_address_line1,
            'shipping_address_line2' => $request->shipping_address_line2,
            'shipping_name' => $request->shipping_name,
            'shipping_phone' => $request->shipping_phone,
        ];

        // 配送料金を自動計算
        try {
            $calculator = app(ShippingCalculatorService::class);
            $region = $calculator->getRegionByPrefecture($request->shipping_prefecture);
            if ($region) {
                $item = $wonItem->item;
                $result = $calculator->calculate(
                    [['quantity' => $item->quantity]],
                    $region
                );
                $updateData['shipping_fee'] = $result['total_shipping_fee'];
                $updateData['shipping_breakdown'] = $result;
            }
        } catch (\Exception $e) {
            \Log::warning('配送料金の自動計算に失敗', ['error' => $e->getMessage()]);
        }

        $wonItem->update($updateData);

        return response()->json([
            'success' => true,
            'message' => '配送先を更新しました。',
            'data' => [
                'shipping_address' => $this->formatShippingAddress($wonItem),
                'shipping_fee' => $wonItem->shipping_fee ?? 0,
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
