<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Services\StorageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class ItemController extends Controller
{
    public function __construct(
        private readonly StorageService $storage,
    ) {}

    /**
     * 出品履歴一覧を取得
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $sellerProfile = SellerProfile::where('user_id', $user->id)->first();
        
        if (!$sellerProfile) {
            return response()->json([
                'success' => true,
                'data' => [
                    'items' => [],
                    'pagination' => [
                        'total' => 0,
                        'per_page' => 20,
                        'current_page' => 1,
                        'last_page' => 1,
                    ],
                ],
            ]);
        }
        
        $perPage = $request->input('per_page', 20);
        $status = $request->input('status');
        $search = $request->input('search');
        
        $query = Item::where('seller_profile_id', $sellerProfile->id)
            ->with(['auction:id,title,event_date,status', 'wonItem:item_id,winning_price,quantity,payment_status,delivery_status']);
        
        // ステータスフィルター
        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }
        
        // 検索
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('species_name', 'like', '%' . $search . '%')
                  ->orWhere('item_number', 'like', '%' . $search . '%');
            });
        }
        
        $items = $query->orderByDesc('created_at')->paginate($perPage);
        
        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'item_number' => $item->item_number,
                        'species_name' => $item->species_name,
                        'quantity' => $item->quantity,
                        'start_price' => $item->start_price,
                        'current_price' => $item->current_price,
                        'estimated_price' => $item->estimated_price,
                        'is_premium' => $item->is_premium,
                        'status' => $item->status,
                        'thumbnail_path' => $item->thumbnail_path,
                        'auction' => $item->auction ? [
                            'id' => $item->auction->id,
                            'title' => $item->auction->title,
                            'event_date' => $item->auction->event_date->format('Y-m-d'),
                            'status' => $item->auction->status,
                        ] : null,
                        'won_item' => $item->wonItem ? [
                            'winning_price' => $item->wonItem->winning_price,
                            'quantity' => $item->wonItem->quantity,
                            'payment_status' => $item->wonItem->payment_status,
                            'delivery_status' => $item->wonItem->delivery_status,
                        ] : null,
                        'created_at' => $item->created_at->format('Y-m-d H:i:s'),
                    ];
                }),
                'pagination' => [
                    'total' => $items->total(),
                    'per_page' => $items->perPage(),
                    'current_page' => $items->currentPage(),
                    'last_page' => $items->lastPage(),
                ],
            ],
        ]);
    }

    /**
     * 出品可能なオークション一覧を取得
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function getAvailableAuctions()
    {
        $auctions = Auction::whereIn('status', ['preparing', 'scheduled'])
            ->where(function ($query) {
                $query->whereNull('upload_deadline')
                      ->orWhere('upload_deadline', '>', now());
            })
            ->orderBy('event_date')
            ->get(['id', 'title', 'event_date', 'status', 'upload_deadline']);
        
        return response()->json([
            'success' => true,
            'data' => [
                'auctions' => $auctions->map(function ($auction) {
                    return [
                        'id' => $auction->id,
                        'title' => $auction->title,
                        'event_date' => $auction->event_date->format('Y-m-d'),
                        'status' => $auction->status,
                        'upload_deadline' => $auction->upload_deadline?->format('Y-m-d H:i:s'),
                    ];
                }),
            ],
        ]);
    }

    /**
     * 出品申込を作成
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'auction_id' => 'required|exists:auctions,id',
            'species_name' => 'required|string|max:255',
            'quantity' => 'required|integer|min:1',
            'start_price' => 'nullable|numeric|min:0',
            'estimated_price' => 'nullable|numeric|min:1',
            'inspection_info' => 'nullable|string',
            'individual_info' => 'nullable|string',
            'notes' => 'nullable|string',
            'is_premium' => 'boolean',
            'unsold_action' => 'nullable|in:return,free_pickup,relist',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = Auth::user();
        $sellerProfile = $this->getOrCreateSellerProfile($user);
        
        // オークションの確認
        $auction = Auction::find($request->auction_id);
        
        if (!in_array($auction->status, ['preparing', 'scheduled'])) {
            return response()->json([
                'success' => false,
                'message' => 'このオークションは出品受付を終了しています。',
            ], 422);
        }
        
        if ($auction->upload_deadline && $auction->upload_deadline < now()) {
            return response()->json([
                'success' => false,
                'message' => '出品申込の締め切りを過ぎています。',
            ], 422);
        }
        
        // 生体番号を自動採番
        $maxItemNumber = Item::where('auction_id', $auction->id)->max('item_number') ?? 0;
        $itemNumber = $maxItemNumber + 1;
        
        // 開始価格が未設定の場合はデフォルト値100円を設定
        $startPrice = $request->start_price ?? 100;
        if ($startPrice < 100) {
            $startPrice = 100;
        }
        
        $item = Item::create([
            'auction_id' => $request->auction_id,
            'seller_profile_id' => $sellerProfile->id,
            'item_number' => $itemNumber,
            'species_name' => $request->species_name,
            'quantity' => $request->quantity,
            'start_price' => $startPrice,
            'current_price' => $startPrice,
            'estimated_price' => $request->estimated_price,
            'inspection_info' => $request->inspection_info,
            'individual_info' => $request->individual_info,
            'notes' => $request->notes,
            'is_premium' => $request->boolean('is_premium', false),
            'unsold_action' => $request->unsold_action ?? 'return',
            'status' => 'draft',
        ]);
        
        return response()->json([
            'success' => true,
            'message' => '出品申込を受け付けました。',
            'data' => [
                'item' => [
                    'id' => $item->id,
                    'item_number' => $item->item_number,
                    'species_name' => $item->species_name,
                    'status' => $item->status,
                ],
            ],
        ], 201);
    }

    /**
     * 出品詳細を取得
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show($id)
    {
        $user = Auth::user();
        $sellerProfile = SellerProfile::where('user_id', $user->id)->first();
        
        if (!$sellerProfile) {
            return response()->json([
                'success' => false,
                'message' => '出品者情報が見つかりません。',
            ], 404);
        }
        
        $item = Item::where('id', $id)
            ->where('seller_profile_id', $sellerProfile->id)
            ->with(['auction:id,title,event_date,status', 'media', 'wonItem'])
            ->first();
        
        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => '出品情報が見つかりません。',
            ], 404);
        }
        
        return response()->json([
            'success' => true,
            'data' => [
                'item' => [
                    'id' => $item->id,
                    'item_number' => $item->item_number,
                    'species_name' => $item->species_name,
                    'quantity' => $item->quantity,
                    'start_price' => $item->start_price,
                    'current_price' => $item->current_price,
                    'estimated_price' => $item->estimated_price,
                    'inspection_info' => $item->inspection_info,
                    'individual_info' => $item->individual_info,
                    'notes' => $item->notes,
                    'is_premium' => $item->is_premium,
                    'status' => $item->status,
                    'unsold_action' => $item->unsold_action,
                    'thumbnail_path' => $item->thumbnail_path,
                    'auction' => $item->auction ? [
                        'id' => $item->auction->id,
                        'title' => $item->auction->title,
                        'event_date' => $item->auction->event_date->format('Y-m-d'),
                        'status' => $item->auction->status,
                    ] : null,
                    'media' => $item->media->map(function ($m) {
                        return [
                            'id' => $m->id,
                            'media_type' => $m->media_type,
                            'file_path' => $m->file_path,
                            'file_url' => $this->getFileUrl($m->file_path),
                            'is_thumbnail' => $m->is_thumbnail,
                        ];
                    }),
                    'won_item' => $item->wonItem ? [
                        'winning_price' => $item->wonItem->winning_price,
                        'quantity' => $item->wonItem->quantity,
                        'total_amount' => $item->wonItem->total_amount,
                        'commission_amount' => $item->wonItem->commission_amount,
                        'seller_amount' => $item->wonItem->seller_amount,
                        'payment_status' => $item->wonItem->payment_status,
                        'delivery_status' => $item->wonItem->delivery_status,
                    ] : null,
                    'created_at' => $item->created_at->format('Y-m-d H:i:s'),
                    'updated_at' => $item->updated_at->format('Y-m-d H:i:s'),
                ],
            ],
        ]);
    }

    /**
     * 出品情報を更新
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        $user = Auth::user();
        $sellerProfile = SellerProfile::where('user_id', $user->id)->first();
        
        if (!$sellerProfile) {
            return response()->json([
                'success' => false,
                'message' => '出品者情報が見つかりません。',
            ], 404);
        }
        
        $item = Item::where('id', $id)
            ->where('seller_profile_id', $sellerProfile->id)
            ->first();
        
        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => '出品情報が見つかりません。',
            ], 404);
        }
        
        // 編集可能なステータスか確認
        if (!in_array($item->status, ['draft', 'registered'])) {
            return response()->json([
                'success' => false,
                'message' => 'この出品情報は編集できません。',
            ], 422);
        }
        
        $validator = Validator::make($request->all(), [
            'species_name' => 'string|max:255',
            'quantity' => 'integer|min:1',
            'start_price' => 'nullable|numeric|min:0',
            'estimated_price' => 'nullable|numeric|min:1',
            'inspection_info' => 'nullable|string',
            'individual_info' => 'nullable|string',
            'notes' => 'nullable|string',
            'is_premium' => 'boolean',
            'unsold_action' => 'nullable|in:return,free_pickup,relist',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }
        
        // 開始価格の処理
        $updateData = $request->only([
            'species_name',
            'quantity',
            'estimated_price',
            'inspection_info',
            'individual_info',
            'notes',
            'is_premium',
            'unsold_action',
        ]);
        
        if ($request->has('start_price')) {
            $startPrice = $request->start_price ?? 100;
            if ($startPrice < 100) {
                $startPrice = 100;
            }
            $updateData['start_price'] = $startPrice;
            $updateData['current_price'] = $startPrice;
        }
        
        $item->update($updateData);
        
        return response()->json([
            'success' => true,
            'message' => '出品情報を更新しました。',
            'data' => [
                'item' => [
                    'id' => $item->id,
                    'species_name' => $item->species_name,
                    'status' => $item->status,
                ],
            ],
        ]);
    }

    /**
     * 出品をキャンセル
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy($id)
    {
        $user = Auth::user();
        $sellerProfile = SellerProfile::where('user_id', $user->id)->first();
        
        if (!$sellerProfile) {
            return response()->json([
                'success' => false,
                'message' => '出品者情報が見つかりません。',
            ], 404);
        }
        
        $item = Item::where('id', $id)
            ->where('seller_profile_id', $sellerProfile->id)
            ->first();
        
        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => '出品情報が見つかりません。',
            ], 404);
        }
        
        // キャンセル可能なステータスか確認
        if (!in_array($item->status, ['draft', 'registered'])) {
            return response()->json([
                'success' => false,
                'message' => 'この出品はキャンセルできません。',
            ], 422);
        }
        
        $item->status = 'cancelled';
        $item->save();
        
        return response()->json([
            'success' => true,
            'message' => '出品をキャンセルしました。',
        ]);
    }

    /**
     * 出品統計を取得
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function stats()
    {
        $user = Auth::user();
        $sellerProfile = SellerProfile::where('user_id', $user->id)->first();
        
        if (!$sellerProfile) {
            return response()->json([
                'success' => true,
                'data' => [
                    'stats' => [
                        'total_items' => 0,
                        'items_this_month' => 0,
                        'total_sales' => 0,
                        'sales_this_month' => 0,
                        'pending_payment' => 0,
                        'items_shipping' => 0,
                    ],
                ],
            ]);
        }
        
        $totalItems = Item::where('seller_profile_id', $sellerProfile->id)
            ->whereNotIn('status', ['cancelled'])
            ->count();
        
        $itemsThisMonth = Item::where('seller_profile_id', $sellerProfile->id)
            ->whereNotIn('status', ['cancelled'])
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->count();
        
        // 売上は won_items テーブルから集計
        $totalSales = Item::where('seller_profile_id', $sellerProfile->id)
            ->whereHas('wonItem')
            ->with('wonItem')
            ->get()
            ->sum(function ($item) {
                return $item->wonItem->seller_amount ?? 0;
            });
        
        $salesThisMonth = Item::where('seller_profile_id', $sellerProfile->id)
            ->whereHas('wonItem', function ($q) {
                $q->whereMonth('created_at', now()->month)
                  ->whereYear('created_at', now()->year);
            })
            ->with('wonItem')
            ->get()
            ->sum(function ($item) {
                return $item->wonItem->seller_amount ?? 0;
            });
        
        $pendingPayment = Item::where('seller_profile_id', $sellerProfile->id)
            ->whereHas('wonItem', function ($q) {
                $q->where('payment_status', 'pending');
            })
            ->with('wonItem')
            ->get()
            ->sum(function ($item) {
                return $item->wonItem->seller_amount ?? 0;
            });
        
        $itemsShipping = Item::where('seller_profile_id', $sellerProfile->id)
            ->whereHas('wonItem', function ($q) {
                $q->where('delivery_status', 'pending')
                  ->where('payment_status', 'confirmed');
            })
            ->count();
        
        return response()->json([
            'success' => true,
            'data' => [
                'stats' => [
                    'total_items' => $totalItems,
                    'items_this_month' => $itemsThisMonth,
                    'total_sales' => $totalSales,
                    'sales_this_month' => $salesThisMonth,
                    'pending_payment' => $pendingPayment,
                    'items_shipping' => $itemsShipping,
                ],
            ],
        ]);
    }

    /**
     * 出品者プロファイルを取得または作成
     *
     * @param \App\Models\User $user
     * @return SellerProfile
     */
    protected function getOrCreateSellerProfile($user): SellerProfile
    {
        $sellerProfile = SellerProfile::where('user_id', $user->id)->first();
        
        if (!$sellerProfile) {
            // seller_code を自動生成 (S + ユーザーID を6桁ゼロ埋め)
            $sellerCode = 'S' . str_pad($user->id, 6, '0', STR_PAD_LEFT);
            
            $sellerProfile = SellerProfile::create([
                'user_id' => $user->id,
                'seller_code' => $sellerCode,
                'seller_name' => $user->name,
                'contact_name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone ?? '000-0000-0000',
                'is_active' => true,
            ]);
        }
        
        return $sellerProfile;
    }

    /** @deprecated StorageService::disk() を使用してください */
    protected function getStorageDisk(): string
    {
        return $this->storage->disk();
    }

    /** @deprecated StorageService::url() を使用してください */
    protected function getFileUrl(?string $path): ?string
    {
        return $this->storage->url($path);
    }
}

