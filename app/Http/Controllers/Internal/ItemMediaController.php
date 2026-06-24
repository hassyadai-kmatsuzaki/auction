<?php

namespace App\Http\Controllers\Internal;

use App\Actions\Item\DeleteMediaAction;
use App\Actions\Item\UploadMediaAction;
use App\Http\Controllers\Controller;
use App\Models\Auction;
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
        private readonly DeleteMediaAction  $deleteMediaAction,
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

        return $this->performUpload($item, $request);
    }

    /**
     * 社内ツール用 メディアアップロード（出品ID版）。
     * AI動画パイプラインが items.id を扱わず、(auction_id + exhibit_code) で紐付けるための入口。
     * ボディ仕様・冪等性・1ファイル=1リクエストは {@see upload()}（items.id 版）と完全に同一。
     * 認証: auth:sanctum + check.role:admin（routes/api.php 側で適用）。
     * 仕様: docs/api/internal-item-media-upload.md
     */
    public function uploadByExhibitCode(Request $request, int $auctionId, string $exhibitCode): JsonResponse
    {
        $resolved = $this->resolveItemByExhibitCode($auctionId, $exhibitCode);
        if ($resolved instanceof JsonResponse) {
            return $resolved;
        }

        return $this->performUpload($resolved, $request);
    }

    /**
     * 社内ツール用 メディア全削除（出品ID版）。
     * AI動画パイプラインの「全削除 → 再作成」のための入口。
     * exhibit_code（出品コード）と auction_id だけで item を解決するため、items.id 取得（admin GET）が不要。
     * 認証は uploadByExhibitCode と同一（auth:sanctum + check.role:admin、routes/api.php 側で適用）なので、
     * 既存の内部メディアPOSTと同じトークンでそのまま叩ける。
     *
     * 動作:
     *   - item に紐づく全 ItemMedia を {@see DeleteMediaAction} で削除（DBレコード + S3実体）。
     *     S3実体は file_path（本体）/ poster_path（自動生成ポスター）/ original_path（無圧縮オリジナル）の3点。
     *   - サムネイル指定があれば items.thumbnail_path もクリアされる（DeleteMediaAction 内で処理）。
     *   - 許可状態は preparing / scheduled のみ（live 以降は 422）。全削除〜再作成の間に一瞬0枚になるが開催前なので問題なし。
     *   - メディアが0件でも 200（冪等。再実行・空itemへの呼び出しを安全にする）。
     *
     * 認証: auth:sanctum + check.role:admin（routes/api.php 側で適用）。
     */
    public function deleteAllByExhibitCode(int $auctionId, string $exhibitCode): JsonResponse
    {
        $resolved = $this->resolveItemByExhibitCode($auctionId, $exhibitCode);
        if ($resolved instanceof JsonResponse) {
            return $resolved;
        }

        $item  = $resolved;
        $media = $item->media()->get();

        $deleted = 0;
        foreach ($media as $m) {
            // 1メディア = 1 DeleteMediaAction。S3本体・ポスター・オリジナルとDBレコードをまとめて消す。
            $this->deleteMediaAction->execute($item, $m);
            $deleted++;
        }

        return response()->json([
            'success' => true,
            'message' => "メディアを {$deleted} 件削除しました。",
            'data'    => [
                'auction_id'    => $auctionId,
                'exhibit_code'  => $exhibitCode,
                'item_id'       => $item->id,
                'deleted_count' => $deleted,
            ],
        ]);
    }

    /**
     * (auction_id, exhibit_code) から Item を一意解決する。
     * upload / delete の両系で同一の検証（auction存在・開催前状態・item一意性）を共有するためのヘルパ。
     *
     * @return Item|JsonResponse 解決できれば Item、できなければエラーレスポンス（呼び出し側でそのまま return）。
     */
    private function resolveItemByExhibitCode(int $auctionId, string $exhibitCode): Item|JsonResponse
    {
        // ① auction の存在と「メディアを操作できる状態」を検証（誤った auction_id での誤爆防止）。
        //    exhibit_code は非ユニーク（オークション毎に再利用）なので auction_id がスコープキー。
        //    撮影〜編集〜登録は開催前に行われるため、許可は preparing / scheduled のみ（live 以降は不可）。
        $auction = Auction::find($auctionId);
        if ($auction === null) {
            return response()->json([
                'success' => false,
                'message' => '指定された auction_id が存在しません。',
            ], 404);
        }

        if (! in_array($auction->status, ['preparing', 'scheduled'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'このオークションは現在メディアを操作できる状態（開催前）ではありません。',
            ], 422);
        }

        // ② (auction_id, exhibit_code) で item を一意特定。
        $matches = Item::where('auction_id', $auctionId)
            ->where('exhibit_code', $exhibitCode)
            ->get();

        if ($matches->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => '指定された出品ID（exhibit_code）に該当する商品が見つかりません。',
            ], 404);
        }

        if ($matches->count() > 1) {
            // 本来は (lane_name + sequence_order) 由来でオークション内ユニークなので起きない想定。
            return response()->json([
                'success' => false,
                'message' => '指定された出品IDに該当する商品が複数存在します。運営に連絡してください。',
            ], 409);
        }

        return $matches->first();
    }

    /**
     * 解決済みの Item に対するアップロード本体（バリデーション + 冪等性 + 保存）。
     * items.id 版・exhibit_code 版の両方から呼ばれる共通処理。
     */
    private function performUpload(Item $item, Request $request): JsonResponse
    {
        $itemId = $item->id;

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
