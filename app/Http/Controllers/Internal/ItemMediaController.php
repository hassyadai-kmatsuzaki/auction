<?php

namespace App\Http\Controllers\Internal;

use App\Actions\Item\UploadMediaAction;
use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\ItemMedia;
use App\Services\StorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;

class ItemMediaController extends Controller
{
    public function __construct(
        private readonly UploadMediaAction $uploadMediaAction,
        private readonly StorageService    $storage,
    ) {}

    /**
     * 社内ツール用 メディアアップロード。
     * 認証: auth:sanctum + check.role:admin（routes/api.php 側で適用）。
     * 仕様: docs/api/internal-item-media-upload.md
     */
    public function upload(Request $request, int $itemId): JsonResponse
    {
        $item = Item::findOrFail($itemId);

        $validator = Validator::make($request->all(), [
            'file' => [
                'required',
                'file',
                'extensions:jpg,jpeg,png,gif,webp,mp4,mov,webm',
                'max:102400',
            ],
            'media_type'   => 'required|in:image,video',
            'is_thumbnail' => 'nullable|boolean',
        ], [
            'file.required'       => 'ファイルを選択してください。',
            'file.file'           => 'ファイルが正しくアップロードされていません。',
            'file.extensions'     => '対応形式は jpg, jpeg, png, gif, webp, mp4, mov, webm のみです。',
            'file.max'            => 'ファイルサイズは 100MB 以下にしてください。',
            'media_type.required' => 'メディア種別を指定してください。',
            'media_type.in'       => 'メディア種別が不正です。',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $mediaType  = $request->input('media_type');
        $result = $this->uploadMediaAction->execute(
            $item,
            $request->file('file'),
            $mediaType,
            $request->boolean('is_thumbnail', false),
        );

        $response = $result->toResponse(201);

        if (!$result->success) {
            return $response;
        }

        $payload = $response->getData(true);
        $mediaPayload = $payload['data']['media'] ?? null;

        // 既存 UploadMediaAction は変更しない方針のため、ここで processing を合成する。
        if ($mediaType === 'video' && $mediaPayload) {
            $payload['data']['processing'] = [
                'poster_generated'   => !empty($mediaPayload['poster_path']),
                'compression_status' => 'queued',
            ];
            $response->setData($payload);
        }

        return $response;
    }

    /**
     * 社内ツール用 サムネイル指定（既存メディアの中から1つを選ぶ）。
     * 動画は不可。既存サムネイルは自動で解除される。
     */
    public function setThumbnail(int $itemId, int $mediaId): JsonResponse
    {
        $item  = Item::findOrFail($itemId);
        $media = ItemMedia::where('item_id', $itemId)
            ->where('id', $mediaId)
            ->firstOrFail();

        if (str_starts_with((string) $media->media_type, 'video')
            || str_starts_with((string) $media->mime_type, 'video/')) {
            return response()->json([
                'success' => false,
                'message' => '動画はサムネイルに指定できません。画像を選択してください。',
            ], 422);
        }

        ItemMedia::where('item_id', $itemId)->update(['is_thumbnail' => false]);

        $media->is_thumbnail = true;
        $media->save();

        $item->thumbnail_path = $this->storage->url($media->file_path);
        $item->save();

        return response()->json([
            'success' => true,
            'message' => 'サムネイルを設定しました。',
            'data'    => [
                'item_id'         => $item->id,
                'media_id'        => $media->id,
                'thumbnail_url'   => $item->thumbnail_path,
            ],
        ]);
    }

    /**
     * 社内ツール用 メディア処理状態取得。
     * Redis(`media:proc:{mediaId}`) と item_media の現状から派生ステータスを返す。
     */
    public function show(int $itemId, int $mediaId): JsonResponse
    {
        $media = ItemMedia::where('id', $mediaId)
            ->where('item_id', $itemId)
            ->firstOrFail();

        $cached = null;
        try {
            $cached = Cache::store('redis')->get("media:proc:{$mediaId}");
        } catch (\Throwable $e) {
            // Redis 失敗時は status=unknown 扱いで返す（観測のためのAPIなので致命ではない）
            \Log::warning('Internal media show: redis read failed', [
                'media_id' => $mediaId,
                'error'    => $e->getMessage(),
            ]);
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'media' => [
                    'id'            => $media->id,
                    'media_type'    => $media->media_type,
                    'file_path'     => $media->file_path,
                    'file_url'      => $this->storage->url($media->file_path),
                    'poster_path'   => $media->poster_path,
                    'poster_url'    => $this->storage->url($media->poster_path),
                    'mime_type'     => $media->mime_type,
                    'file_size'     => $media->file_size,
                    'is_processed'  => (bool) $media->is_processed,
                    'is_thumbnail'  => (bool) $media->is_thumbnail,
                    'display_order' => $media->display_order,
                ],
                'processing' => [
                    'status' => $cached['status'] ?? 'unknown',
                    'reason' => $cached['reason'] ?? null,
                    'at'     => $cached['at'] ?? null,
                ],
            ],
        ]);
    }
}
