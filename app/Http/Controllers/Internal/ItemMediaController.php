<?php

namespace App\Http\Controllers\Internal;

use App\Actions\Item\UploadMediaAction;
use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\ItemMedia;
use App\Services\IdempotencyService;
use App\Services\StorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;

class ItemMediaController extends Controller
{
    private const IDEMPOTENCY_SCOPE = 'internal-upload';

    public function __construct(
        private readonly UploadMediaAction  $uploadMediaAction,
        private readonly StorageService     $storage,
        private readonly IdempotencyService $idempotency,
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

        $mediaType    = $request->input('media_type');
        $isThumbnail  = $request->boolean('is_thumbnail', false);
        $idempotencyKey = $this->extractIdempotencyKey($request);

        if ($idempotencyKey !== null) {
            $requestHash = $this->buildRequestHash(
                $itemId,
                $mediaType,
                $isThumbnail,
                $request->file('file'),
            );

            $claim = $this->idempotency->claim(self::IDEMPOTENCY_SCOPE, $idempotencyKey, $requestHash);

            switch ($claim['result']) {
                case IdempotencyService::REPLAY:
                    return response()
                        ->json($claim['body'], $claim['status'])
                        ->header('Idempotent-Replayed', 'true');

                case IdempotencyService::CONFLICT_PROCESSING:
                    return response()->json([
                        'success' => false,
                        'message' => '同一の Idempotency-Key で処理が進行中です。完了後に再試行してください。',
                    ], 409);

                case IdempotencyService::PAYLOAD_MISMATCH:
                    return response()->json([
                        'success' => false,
                        'message' => '同一の Idempotency-Key に対して異なるリクエスト内容が送られました。',
                    ], 422);
            }
        }

        try {
            $response = $this->runUpload($item, $request->file('file'), $mediaType, $isThumbnail);
        } catch (\Throwable $e) {
            if ($idempotencyKey !== null) {
                $this->idempotency->release(self::IDEMPOTENCY_SCOPE, $idempotencyKey);
            }
            throw $e;
        }

        if ($idempotencyKey !== null) {
            if ($response->getStatusCode() >= 200 && $response->getStatusCode() < 300) {
                $this->idempotency->complete(
                    self::IDEMPOTENCY_SCOPE,
                    $idempotencyKey,
                    $response->getStatusCode(),
                    $response->getData(true),
                );
            } else {
                $this->idempotency->release(self::IDEMPOTENCY_SCOPE, $idempotencyKey);
            }
        }

        return $response;
    }

    private function runUpload(Item $item, \Illuminate\Http\UploadedFile $file, string $mediaType, bool $isThumbnail): JsonResponse
    {
        $result = $this->uploadMediaAction->execute($item, $file, $mediaType, $isThumbnail);
        $response = $result->toResponse(201);

        if (!$result->success) {
            return $response;
        }

        $payload = $response->getData(true);
        $mediaPayload = $payload['data']['media'] ?? null;

        if ($mediaType === 'video' && $mediaPayload) {
            $payload['data']['processing'] = [
                'poster_generated'   => !empty($mediaPayload['poster_path']),
                'compression_status' => 'queued',
            ];
            $response->setData($payload);
        }

        return $response;
    }

    private function extractIdempotencyKey(Request $request): ?string
    {
        $key = $request->header('Idempotency-Key');
        if ($key === null) {
            return null;
        }
        $key = trim($key);
        if ($key === '' || strlen($key) > 128) {
            return null;
        }
        return $key;
    }

    private function buildRequestHash(int $itemId, string $mediaType, bool $isThumbnail, ?\Illuminate\Http\UploadedFile $file): string
    {
        $fileHash = $file ? hash_file('sha256', $file->getRealPath()) : '';
        return hash('sha256', implode('|', [
            $itemId,
            $mediaType,
            $isThumbnail ? '1' : '0',
            $fileHash,
        ]));
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
