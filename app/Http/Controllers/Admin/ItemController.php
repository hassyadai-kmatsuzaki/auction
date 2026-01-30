<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\Item;
use App\Models\ItemMedia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ItemController extends Controller
{
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
            ->with(['sellerProfile:id,seller_name,user_id', 'media']);
        
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
                        'quantity' => $item->quantity,
                        'start_price' => $item->start_price,
                        'current_price' => $item->current_price,
                        'is_premium' => $item->is_premium,
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
            'quantity' => 'required|integer|min:1',
            'start_price' => 'required|numeric|min:1',
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
        
        // 生体番号を自動採番
        $maxItemNumber = Item::where('auction_id', $auctionId)->max('item_number') ?? 0;
        $itemNumber = $maxItemNumber + 1;
        
        $item = Item::create([
            'auction_id' => $auctionId,
            'seller_profile_id' => $request->seller_profile_id,
            'item_number' => $itemNumber,
            'species_name' => $request->species_name,
            'quantity' => $request->quantity,
            'start_price' => $request->start_price,
            'current_price' => $request->start_price,
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
            ->with(['auction:id,title,event_date,status', 'sellerProfile:id,seller_name,user_id', 'media', 'wonItem'])
            ->firstOrFail();
        
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
            'quantity' => 'integer|min:1',
            'start_price' => 'numeric|min:1',
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
        
        $item->update($request->only([
            'species_name',
            'quantity',
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
        
        // 開始価格が変更された場合は現在価格も更新
        if ($request->has('start_price')) {
            $item->current_price = $request->start_price;
            $item->save();
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

    /**
     * ストレージディスクを取得（S3またはpublic）
     */
    protected function getStorageDisk()
    {
        // AWS設定が有効な値である場合のみS3を使用
        $key = config('filesystems.disks.s3.key');
        $bucket = config('filesystems.disks.s3.bucket');
        
        if (!empty($key) && !empty($bucket) && $key !== '' && $bucket !== '') {
            // S3パッケージがインストールされているかチェック
            if (class_exists(\Aws\S3\S3Client::class)) {
                return 's3';
            }
            \Log::warning('S3設定がありますが、aws/aws-sdk-phpがインストールされていません。publicディスクを使用します。');
        }
        
        return 'public';
    }

    /**
     * ファイルのURLを取得
     */
    protected function getFileUrl($path)
    {
        $disk = $this->getStorageDisk();
        if ($disk === 's3') {
            return Storage::disk('s3')->url($path);
        }
        // publicディスクの場合はAPP_URLを使用
        return config('app.url') . '/storage/' . $path;
    }

    /**
     * メディアをアップロード
     *
     * @param Request $request
     * @param int $auctionId
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function uploadMedia(Request $request, $auctionId, $id)
    {
        $item = Item::where('auction_id', $auctionId)
            ->where('id', $id)
            ->firstOrFail();
        
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:jpg,jpeg,png,gif,webp,mp4,mov,webm|max:102400', // 100MB max
            'media_type' => 'required|in:image,video',
            'is_thumbnail' => 'nullable|string', // FormDataでは文字列として送られる
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }
        
        $file = $request->file('file');
        $mediaType = $request->input('media_type');
        $isThumbnail = $request->boolean('is_thumbnail', false);
        
        // ストレージディスクを取得
        $disk = $this->getStorageDisk();
        
        // ファイル名を生成
        $extension = $file->getClientOriginalExtension();
        $filename = 'items/' . $auctionId . '/' . $id . '/' . Str::uuid() . '.' . $extension;
        
        try {
            // ファイルをアップロード
            if ($disk === 's3') {
                // S3設定のデバッグ情報
                \Log::info('S3アップロード開始', [
                    'bucket' => config('filesystems.disks.s3.bucket'),
                    'region' => config('filesystems.disks.s3.region'),
                    'filename' => $filename,
                ]);
                
                $path = Storage::disk('s3')->putFileAs('', $file, $filename, 'public');
                
                \Log::info('S3アップロード結果', ['path' => $path]);
            } else {
                // ディレクトリを事前に作成
                $directory = dirname($filename);
                if (!Storage::disk('public')->exists($directory)) {
                    Storage::disk('public')->makeDirectory($directory);
                }
                $path = Storage::disk('public')->putFileAs('', $file, $filename);
            }
            
            if (!$path) {
                throw new \Exception('ファイルの保存に失敗しました。ディスク: ' . $disk);
            }
        } catch (\Aws\S3\Exception\S3Exception $e) {
            \Log::error('S3エラー: ' . $e->getMessage(), [
                'aws_error_code' => $e->getAwsErrorCode(),
                'aws_error_message' => $e->getAwsErrorMessage(),
                'disk' => $disk,
                'filename' => $filename,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'S3アップロードエラー: ' . $e->getAwsErrorMessage(),
            ], 500);
        } catch (\Exception $e) {
            \Log::error('メディアアップロードエラー: ' . $e->getMessage(), [
                'disk' => $disk,
                'filename' => $filename,
                'file_size' => $file->getSize(),
                'mime_type' => $file->getMimeType(),
                'exception_class' => get_class($e),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'ファイルのアップロードに失敗しました: ' . $e->getMessage(),
            ], 500);
        }
        
        // サムネイル設定時は既存のサムネイルを解除
        if ($isThumbnail) {
            ItemMedia::where('item_id', $id)->update(['is_thumbnail' => false]);
            
            // サムネイルパスを更新
            $item->thumbnail_path = $this->getFileUrl($path);
            $item->save();
        }
        
        // メディアレコードを作成
        $displayOrder = ItemMedia::where('item_id', $id)->max('display_order') ?? 0;
        
        // media_type をDBのenum値に変換
        $dbMediaType = $mediaType === 'image' ? 'photo_other' : 'video_top';
        
        $media = ItemMedia::create([
            'item_id' => $id,
            'media_type' => $dbMediaType,
            'file_path' => $path,
            'file_name' => $file->getClientOriginalName(),
            'file_size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
            'is_thumbnail' => $isThumbnail,
            'display_order' => $displayOrder + 1,
        ]);
        
        return response()->json([
            'success' => true,
            'message' => 'ファイルをアップロードしました。',
            'data' => [
                'media' => [
                    'id' => $media->id,
                    'media_type' => $media->media_type,
                    'file_path' => $media->file_path,
                    'file_url' => $this->getFileUrl($media->file_path),
                    'is_thumbnail' => $media->is_thumbnail,
                ],
            ],
        ], 201);
    }

    /**
     * メディアを削除
     *
     * @param int $auctionId
     * @param int $id
     * @param int $mediaId
     * @return \Illuminate\Http\JsonResponse
     */
    public function deleteMedia($auctionId, $id, $mediaId)
    {
        $item = Item::where('auction_id', $auctionId)
            ->where('id', $id)
            ->firstOrFail();
        
        $media = ItemMedia::where('item_id', $id)
            ->where('id', $mediaId)
            ->firstOrFail();
        
        // ストレージからファイルを削除
        if ($media->file_path) {
            $disk = $this->getStorageDisk();
            Storage::disk($disk)->delete($media->file_path);
        }
        
        // サムネイルだった場合はクリア
        if ($media->is_thumbnail) {
            $item->thumbnail_path = null;
            $item->save();
        }
        
        $media->delete();
        
        return response()->json([
            'success' => true,
            'message' => 'ファイルを削除しました。',
        ]);
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
        
        $updated = Item::where('auction_id', $auctionId)
            ->whereIn('id', $itemIds)
            ->whereNotIn('status', ['live', 'sold'])
            ->update(['status' => $status]);
        
        return response()->json([
            'success' => true,
            'message' => "{$updated}件の生体のステータスを更新しました。",
        ]);
    }
}
