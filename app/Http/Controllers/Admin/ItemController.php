<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\Item;
use App\Models\ItemMedia;
use App\Models\SpeciesType;
use App\Actions\Item\DeleteMediaAction;
use App\Actions\Item\UploadMediaAction;
use App\Services\ItemImportService;
use App\Services\StorageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ItemController extends Controller
{
    public function __construct(
        private readonly ItemImportService $importService,
        private readonly StorageService    $storage,
        private readonly UploadMediaAction $uploadMediaAction,
        private readonly DeleteMediaAction $deleteMediaAction,
    ) {}

    /**
     * 生体一覧を取得
     *
     * @param Request $request
     * @param int $auctionId
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request, $auctionId)
    {
        $auction = Auction::findOrFail($auctionId);
        
        $perPage = $request->input('per_page', 20);
        $status = $request->input('status');
        $search = $request->input('search');
        
        $query = Item::where('auction_id', $auctionId)
            ->with(['sellerProfile:id,seller_name,user_id', 'media', 'speciesType:id,code,name']);

        // 種別フィルタ
        if ($request->filled('species_type_id')) {
            $query->where('species_type_id', $request->input('species_type_id'));
        }
        
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
        
        $items = $query->orderBy('item_number')->paginate($perPage);
        
        return response()->json([
            'success' => true,
            'data' => [
                'auction' => [
                    'id' => $auction->id,
                    'title' => $auction->title,
                    'event_date' => $auction->event_date->format('Y-m-d'),
                    'status' => $auction->status,
                ],
                'items' => $items->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'item_number' => $item->item_number,
                        'species_name' => $item->species_name,
                        'species_type' => $item->speciesType ? [
                            'id' => $item->speciesType->id,
                            'code' => $item->speciesType->code,
                            'name' => $item->speciesType->name,
                        ] : null,
                        'quantity' => $item->quantity,
                        'quantity_unit' => $item->quantity_unit ?? 'fish',
                        'start_price' => $item->start_price,
                        'current_price' => $item->current_price,
                        'is_premium' => $item->is_premium,
                        'is_anonymous' => (bool) $item->is_anonymous,
                        'status' => $item->status,
                        'thumbnail_path' => $item->thumbnail_path,
                        'seller' => $item->sellerProfile ? [
                            'id' => $item->sellerProfile->id,
                            'name' => $item->sellerProfile->seller_name,
                        ] : null,
                        'media_count' => $item->media->count(),
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
     * 生体を作成
     *
     * @param Request $request
     * @param int $auctionId
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request, $auctionId)
    {
        $auction = Auction::findOrFail($auctionId);
        
        $validator = Validator::make($request->all(), [
            'species_name' => 'required|string|max:255',
            'species_type_id' => 'nullable|integer|exists:species_types,id',
            'quantity' => 'required|integer|min:1',
            'quantity_unit' => 'nullable|string|in:fish,kg,bag',
            'start_price' => 'required|numeric|min:1',
            // @deprecated reserve_price, estimated_price, bid_increment はフロントエンドで未使用。DB互換のため残存。
            'reserve_price' => 'nullable|numeric|min:1',
            'estimated_price' => 'nullable|numeric|min:1',
            'bid_increment' => 'nullable|numeric|min:1',
            'inspection_info' => 'nullable|string',
            'individual_info' => 'nullable|string',
            'notes' => 'nullable|string',
            'is_premium' => 'boolean',
            'seller_profile_id' => 'nullable|exists:seller_profiles,id',
            'unsold_action' => 'nullable|in:return,free_pickup,relist',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $speciesType = $this->resolveSpeciesType($request->input('species_type_id'));
        $quantityUnit = $request->input('quantity_unit', SpeciesType::UNIT_FISH);
        if (!$speciesType->allowsQuantityUnit($quantityUnit)) {
            return response()->json([
                'success' => false,
                'errors' => ['quantity_unit' => ["「{$speciesType->name}」では単位「{$quantityUnit}」は使用できません。"]],
            ], 422);
        }

        // トランザクションと行ロックで生体番号の重複を防ぐ
        \DB::beginTransaction();
        try {
            // 行ロックを使用して最大item_numberを取得
            $maxItemNumber = Item::where('auction_id', $auctionId)
                ->lockForUpdate()
                ->max('item_number') ?? 0;
            $itemNumber = $maxItemNumber + 1;
            
            $item = Item::create([
                'auction_id' => $auctionId,
                'seller_profile_id' => $request->seller_profile_id,
                'item_number' => $itemNumber,
                'species_name' => $request->species_name,
                'species_type_id' => $speciesType->id,
                'quantity' => $request->quantity,
                'quantity_unit' => $quantityUnit,
                'start_price' => $request->start_price,
                'current_price' => $request->start_price,
                // @deprecated reserve_price, estimated_price, bid_increment はフロントエンドで未使用。DB互換のため残存。
                'reserve_price' => $request->reserve_price,
                'estimated_price' => $request->estimated_price,
                'bid_increment' => $request->bid_increment ?? 100,
                'inspection_info' => $request->inspection_info,
                'individual_info' => $request->individual_info,
                'notes' => $request->notes,
                'is_premium' => $request->boolean('is_premium', false),
                'unsold_action' => $request->unsold_action ?? 'return',
                'status' => 'registered',
            ]);
            
            \DB::commit();
        } catch (\Exception $e) {
            \DB::rollBack();
            throw $e;
        }
        
        return response()->json([
            'success' => true,
            'message' => '生体を登録しました。',
            'data' => [
                'item' => [
                    'id' => $item->id,
                    'item_number' => $item->item_number,
                    'species_name' => $item->species_name,
                ],
            ],
        ], 201);
    }

    /**
     * 生体詳細を取得
     *
     * @param int $auctionId
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show($auctionId, $id)
    {
        $item = Item::where('auction_id', $auctionId)
            ->where('id', $id)
            ->with(['auction:id,title,event_date,status', 'sellerProfile:id,seller_name,user_id', 'media', 'wonItem', 'speciesType'])
            ->firstOrFail();
        
        return response()->json([
            'success' => true,
            'data' => [
                'item' => [
                    'id' => $item->id,
                    'item_number' => $item->item_number,
                    'species_name' => $item->species_name,
                    'species_type' => $item->speciesType ? [
                        'id' => $item->speciesType->id,
                        'code' => $item->speciesType->code,
                        'name' => $item->speciesType->name,
                        'calculation_mode' => $item->speciesType->calculation_mode,
                        'allowed_quantity_units' => $item->speciesType->allowed_quantity_units,
                    ] : null,
                    'quantity' => $item->quantity,
                    'quantity_unit' => $item->quantity_unit ?? 'fish',
                    'start_price' => $item->start_price,
                    'current_price' => $item->current_price,
                    'reserve_price' => $item->reserve_price,
                    'estimated_price' => $item->estimated_price,
                    'bid_increment' => $item->bid_increment,
                    'inspection_info' => $item->inspection_info,
                    'individual_info' => $item->individual_info,
                    'notes' => $item->notes,
                    'is_premium' => $item->is_premium,
                    'premium_fee' => $item->premium_fee,
                    'status' => $item->status,
                    'unsold_action' => $item->unsold_action,
                    'thumbnail_path' => $item->thumbnail_path,
                    'auction' => $item->auction ? [
                        'id' => $item->auction->id,
                        'title' => $item->auction->title,
                        'event_date' => $item->auction->event_date->format('Y-m-d'),
                        'status' => $item->auction->status,
                    ] : null,
                    'seller' => $item->sellerProfile ? [
                        'id' => $item->sellerProfile->id,
                        'name' => $item->sellerProfile->seller_name,
                    ] : null,
                    'media' => $item->media->map(function ($m) {
                        return [
                            'id' => $m->id,
                            'media_type' => $m->media_type,
                            'file_path' => $m->file_path,
                            'file_url' => $m->file_path ? $this->getFileUrl($m->file_path) : null,
                            'is_thumbnail' => $m->is_thumbnail,
                            'display_order' => $m->display_order,
                        ];
                    }),
                    'won_item' => $item->wonItem ? [
                        'winning_price' => $item->wonItem->winning_price,
                        'quantity' => $item->wonItem->quantity,
                        'total_amount' => $item->wonItem->total_amount,
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
     * 生体を更新
     *
     * @param Request $request
     * @param int $auctionId
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $auctionId, $id)
    {
        $item = Item::where('auction_id', $auctionId)
            ->where('id', $id)
            ->firstOrFail();
        
        // オークション中や落札済みの場合は編集不可
        if (in_array($item->status, ['live', 'sold'])) {
            return response()->json([
                'success' => false,
                'message' => 'この生体は編集できません。',
            ], 422);
        }
        
        $validator = Validator::make($request->all(), [
            'species_name' => 'string|max:255',
            'species_type_id' => 'nullable|integer|exists:species_types,id',
            'quantity' => 'integer|min:1',
            'quantity_unit' => 'nullable|string|in:fish,kg,bag',
            'start_price' => 'numeric|min:1',
            // @deprecated reserve_price, estimated_price, bid_increment はフロントエンドで未使用。DB互換のため残存。
            'reserve_price' => 'nullable|numeric|min:1',
            'estimated_price' => 'nullable|numeric|min:1',
            'bid_increment' => 'nullable|numeric|min:1',
            'inspection_info' => 'nullable|string',
            'individual_info' => 'nullable|string',
            'notes' => 'nullable|string',
            'is_premium' => 'boolean',
            'seller_profile_id' => 'nullable|exists:seller_profiles,id',
            'unsold_action' => 'nullable|in:return,free_pickup,relist',
            'status' => 'nullable|in:draft,registered,cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        // 種別変更 or 単位変更時は single source of truth としてバリデート
        $changingSpecies = $request->has('species_type_id');
        $changingUnit = $request->has('quantity_unit');
        if ($changingSpecies || $changingUnit) {
            $speciesType = $this->resolveSpeciesType(
                $changingSpecies ? $request->input('species_type_id') : $item->species_type_id
            );
            $unit = $changingUnit ? $request->input('quantity_unit') : ($item->quantity_unit ?? SpeciesType::UNIT_FISH);
            if (!$speciesType->allowsQuantityUnit($unit)) {
                return response()->json([
                    'success' => false,
                    'errors' => ['quantity_unit' => ["「{$speciesType->name}」では単位「{$unit}」は使用できません。"]],
                ], 422);
            }

            // 送料承認済みは種別変更を拒否
            if ($changingSpecies && $item->wonItem && $item->wonItem->shipping_approved_at !== null
                && (int) $item->species_type_id !== (int) $request->input('species_type_id')) {
                return response()->json([
                    'success' => false,
                    'message' => '送料が承認済みのため種別を変更できません。承認を取り消してから変更してください。',
                ], 409);
            }
        }

        $oldStatus = $item->status;

        $item->update($request->only([
            'species_name',
            'species_type_id',
            'quantity',
            'quantity_unit',
            'start_price',
            'reserve_price',
            'estimated_price',
            'bid_increment',
            'inspection_info',
            'individual_info',
            'notes',
            'is_premium',
            'seller_profile_id',
            'unsold_action',
            'status',
        ]));

        // 種別が変わったら未承認の送料計算結果をリセットして再計算を促す
        if ($changingSpecies && $item->wonItem && $item->wonItem->shipping_approved_at === null) {
            $item->wonItem->update([
                'shipping_fee' => 0,
                'shipping_fee_auto' => null,
                'shipping_breakdown' => null,
                'shipping_calculated_at' => null,
                'calculation_mode' => null,
            ]);
        }

        // 開始価格が変更された場合は現在価格も更新
        if ($request->has('start_price')) {
            $item->current_price = $request->start_price;
            $item->save();
        }

        // ステータスが registered 以外に変更された場合はレーンから除外
        if ($request->has('status') && $item->status !== 'registered') {
            $item->lanes()->detach();
        }
        
        return response()->json([
            'success' => true,
            'message' => '生体情報を更新しました。',
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
     * species_type_id → SpeciesType を解決（null/未登録ならデフォルト種別＝メダカ）
     */
    private function resolveSpeciesType(?int $speciesTypeId): SpeciesType
    {
        if ($speciesTypeId) {
            $type = SpeciesType::find($speciesTypeId);
            if ($type) return $type;
        }
        $default = SpeciesType::where('is_default', true)->first()
            ?? SpeciesType::where('code', 'medaka')->first();
        if (!$default) {
            throw new \RuntimeException('デフォルト種別（メダカ）が定義されていません。');
        }
        return $default;
    }

    /**
     * 生体を削除
     *
     * @param int $auctionId
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy($auctionId, $id)
    {
        $item = Item::where('auction_id', $auctionId)
            ->where('id', $id)
            ->firstOrFail();
        
        // オークション中や落札済みの場合は削除不可
        if (in_array($item->status, ['live', 'sold'])) {
            return response()->json([
                'success' => false,
                'message' => 'この生体は削除できません。',
            ], 422);
        }
        
        // メディアファイルを削除
        $disk = $this->getStorageDisk();
        foreach ($item->media as $media) {
            if ($media->file_path) {
                Storage::disk($disk)->delete($media->file_path);
            }
            $media->delete();
        }
        
        $item->delete();
        
        return response()->json([
            'success' => true,
            'message' => '生体を削除しました。',
        ]);
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

    /**
     * メディアをアップロード
     *
     * @param Request $request
     * @param int $auctionId
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    /** メディアをアップロード */
    public function uploadMedia(Request $request, $auctionId, $id)
    {
        $item = Item::where('auction_id', $auctionId)->where('id', $id)->firstOrFail();

        $validator = Validator::make($request->all(), [
            'file'         => [
                'required',
                'file',
                'extensions:jpg,jpeg,png,gif,webp,mp4,mov,webm',
                'max:102400',
            ],
            'media_type'   => 'required|in:image,video',
            'is_thumbnail' => 'nullable|string',
        ], [
            'file.required'   => 'ファイルを選択してください。',
            'file.file'       => 'ファイルが正しくアップロードされていません。',
            'file.extensions' => '対応形式は jpg, jpeg, png, gif, webp, mp4, mov, webm のみです。',
            'file.max'        => 'ファイルサイズは 100MB 以下にしてください。',
            'media_type.required' => 'メディア種別を指定してください。',
            'media_type.in'       => 'メディア種別が不正です。',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        return $this->uploadMediaAction->execute(
            $item,
            $request->file('file'),
            $request->input('media_type'),
            $request->boolean('is_thumbnail', false)
        )->toResponse(201);
    }

    /** メディアを削除 */
    public function deleteMedia($auctionId, $id, $mediaId)
    {
        $item  = Item::where('auction_id', $auctionId)->where('id', $id)->firstOrFail();
        $media = ItemMedia::where('item_id', $id)->where('id', $mediaId)->firstOrFail();

        return $this->deleteMediaAction->execute($item, $media)->toResponse();
    }

    /**
     * メディアの順序を更新
     *
     * @param Request $request
     * @param int $auctionId
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function reorderMedia(Request $request, $auctionId, $id)
    {
        $validator = Validator::make($request->all(), [
            'media_ids' => 'required|array',
            'media_ids.*' => 'integer|exists:item_media,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }
        
        $mediaIds = $request->input('media_ids');
        
        foreach ($mediaIds as $index => $mediaId) {
            ItemMedia::where('id', $mediaId)
                ->where('item_id', $id)
                ->update(['display_order' => $index + 1]);
        }
        
        return response()->json([
            'success' => true,
            'message' => 'メディアの順序を更新しました。',
        ]);
    }

    /**
     * サムネイルを設定
     *
     * @param int $auctionId
     * @param int $id
     * @param int $mediaId
     * @return \Illuminate\Http\JsonResponse
     */
    public function setThumbnail($auctionId, $id, $mediaId)
    {
        $item = Item::where('auction_id', $auctionId)
            ->where('id', $id)
            ->firstOrFail();

        $media = ItemMedia::where('item_id', $id)
            ->where('id', $mediaId)
            ->firstOrFail();

        // 動画はサムネイルに指定できない
        if (str_starts_with((string) $media->media_type, 'video')
            || str_starts_with((string) $media->mime_type, 'video/')) {
            return response()->json([
                'success' => false,
                'message' => '動画はサムネイルに指定できません。画像を選択してください。',
            ], 422);
        }

        // 既存のサムネイルを解除
        ItemMedia::where('item_id', $id)->update(['is_thumbnail' => false]);

        // 新しいサムネイルを設定
        $media->is_thumbnail = true;
        $media->save();

        // アイテムのサムネイルパスを更新
        $item->thumbnail_path = $this->getFileUrl($media->file_path);
        $item->save();

        return response()->json([
            'success' => true,
            'message' => 'サムネイルを設定しました。',
        ]);
    }

    /**
     * 個別ステータス更新
     *
     * @param Request $request
     * @param int $auctionId
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateStatus(Request $request, $auctionId, $id)
    {
        $item = Item::where('auction_id', $auctionId)
            ->where('id', $id)
            ->firstOrFail();

        if (in_array($item->status, ['live', 'sold'])) {
            return response()->json([
                'success' => false,
                'message' => 'オークション中または落札済みの生体のステータスは変更できません。',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:draft,registered,cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $item->update(['status' => $request->input('status')]);

        // ステータスが registered 以外に変更された場合はレーンから除外
        if ($item->status !== 'registered') {
            $item->lanes()->detach();
        }

        return response()->json([
            'success' => true,
            'message' => 'ステータスを更新しました。',
            'data' => ['item' => $item],
        ]);
    }

    /**
     * 一括ステータス更新
     *
     * @param Request $request
     * @param int $auctionId
     * @return \Illuminate\Http\JsonResponse
     */
    public function bulkUpdateStatus(Request $request, $auctionId)
    {
        $validator = Validator::make($request->all(), [
            'item_ids' => 'required|array',
            'item_ids.*' => 'integer|exists:items,id',
            'status' => 'required|in:draft,registered,cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }
        
        $itemIds = $request->input('item_ids');
        $status = $request->input('status');
        
        // ステータスが registered 以外の場合、対象アイテムをレーンから除外
        if ($status !== 'registered') {
            DB::table('lane_items')
                ->whereIn('item_id', $itemIds)
                ->delete();
        }

        $updated = Item::where('auction_id', $auctionId)
            ->whereIn('id', $itemIds)
            ->whereNotIn('status', ['live', 'sold'])
            ->update(['status' => $status]);

        return response()->json([
            'success' => true,
            'message' => "{$updated}件の生体のステータスを更新しました。",
        ]);
    }

    /**
     * CSVテンプレートをダウンロード
     *
     * @param int $auctionId
     * @return \Symfony\Component\HttpFoundation\StreamedResponse
     */
    public function downloadTemplate($auctionId)
    {
        $auction = Auction::findOrFail($auctionId);

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="items_template.csv"',
        ];

        $callback = function () use ($auction) {
            $file = fopen('php://output', 'w');
            
            // BOM for UTF-8
            fprintf($file, chr(0xEF) . chr(0xBB) . chr(0xBF));
            
            // ヘッダー行
            fputcsv($file, [
                '品種名（必須）',
                '匹数（必須）',
                '開始価格（必須）',
                '最低落札価格',
                '落札想定金額',
                '入札単位',
                '個体情報',
                '審査情報',
                '備考',
                'プレミアム（0または1）',
                '未落札時対応（return/free_pickup/relist）',
            ]);
            
            // サンプルデータ
            fputcsv($file, [
                'ボールパイソン アルビノ',
                '1',
                '30000',
                '25000',
                '50000',
                '100',
                '性別：オス / 月齢：約12ヶ月 / 体長：約60cm / 体重：約300g',
                '健康状態：良好 / 餌食い：良好',
                '状態良好です。',
                '0',
                'return',
            ]);
            
            fputcsv($file, [
                'レオパードゲッコー タンジェリン',
                '2',
                '15000',
                '12000',
                '25000',
                '100',
                '性別：メス / 月齢：約6ヶ月 / 体長：約15cm',
                '健康状態：良好 / 餌食い：良好',
                '色彩鮮やかな個体です。',
                '1',
                'return',
            ]);
            
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * CSVから一括インポート
     */
    public function import(Request $request, $auctionId)
    {
        Auction::findOrFail($auctionId);

        $validator = Validator::make($request->all(), [
            'file'              => 'required|file|mimes:csv,txt|max:10240',
            'seller_profile_id' => 'nullable|exists:seller_profiles,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        try {
            $result = $this->importService->importFromCsv(
                $request->file('file')->getRealPath(),
                (int) $auctionId,
                $request->input('seller_profile_id')
            );

            return $result->toResponse();
        } catch (\Exception $e) {
            \Log::error('CSVインポートエラー: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'インポートに失敗しました: ' . $e->getMessage()], 500);
        }
    }

    /**
     * 出品者一覧を取得（インポート用）
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function getSellers()
    {
        $sellers = \App\Models\SellerProfile::where('is_active', true)
            ->select('id', 'seller_name', 'seller_code')
            ->orderBy('seller_name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'sellers' => $sellers,
            ],
        ]);
    }
}
