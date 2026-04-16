<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ItemMedia;
use App\Services\StorageService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;

/**
 * 画像の最適化配信（オンデマンドリサイズ + ディスクキャッシュ）
 *
 * フロントエンドから /api/media/{mediaId}/optimized?w=800&q=80 で呼ぶと
 * リサイズ済みWebP画像をキャッシュ付きで返す。
 * 2回目以降はキャッシュファイルを直接返すので高速。
 */
class OptimizedMediaController extends Controller
{
    /** サイズプリセット（安全制限） */
    private const SIZE_PRESETS = [
        'thumb'  => ['width' => 200,  'quality' => 70],
        'small'  => ['width' => 400,  'quality' => 75],
        'medium' => ['width' => 800,  'quality' => 80],
        'large'  => ['width' => 1200, 'quality' => 85],
    ];

    /** 許可する最大幅 */
    private const MAX_WIDTH = 1600;

    /** キャッシュ保存先（storage/app/public/cache/media/） */
    private const CACHE_DIR = 'cache/media';

    public function __construct(
        private readonly StorageService $storage,
    ) {}

    /**
     * GET /api/media/{mediaId}/optimized
     *
     * Query params:
     *   preset: thumb|small|medium|large （推奨）
     *   w:      任意の幅（preset未指定時）
     *   q:      品質 1-100（デフォルト80）
     *   f:      フォーマット webp|jpg（デフォルト webp）
     */
    public function show(Request $request, int $mediaId): Response
    {
        $media = ItemMedia::find($mediaId);
        if (!$media || !$media->file_path) {
            abort(404);
        }

        // 動画はリサイズ不可 → リダイレクト
        if ($media->mime_type && str_starts_with($media->mime_type, 'video/')) {
            return response('', 302, [
                'Location' => $this->storage->url($media->file_path),
            ]);
        }

        // パラメータ解決
        $preset = $request->query('preset');
        if ($preset && isset(self::SIZE_PRESETS[$preset])) {
            $width   = self::SIZE_PRESETS[$preset]['width'];
            $quality = self::SIZE_PRESETS[$preset]['quality'];
        } else {
            $width   = min((int) ($request->query('w', 800)), self::MAX_WIDTH);
            $quality = max(1, min(100, (int) ($request->query('q', 80))));
        }

        $format = $request->query('f', 'webp');
        if (!in_array($format, ['webp', 'jpg'], true)) {
            $format = 'webp';
        }

        $ext = $format === 'webp' ? 'webp' : 'jpg';
        $mime = $format === 'webp' ? 'image/webp' : 'image/jpeg';

        // キャッシュキー
        $cacheKey = md5($media->file_path . "_{$width}_{$quality}_{$format}");
        $cachePath = self::CACHE_DIR . "/{$cacheKey}.{$ext}";

        $disk = $this->storage->disk();

        // キャッシュヒット
        if (Storage::disk($disk)->exists($cachePath)) {
            $content = Storage::disk($disk)->get($cachePath);
            return $this->respondWithCache($content, $mime);
        }

        // 元画像の読み込み
        $originalContent = Storage::disk($disk)->get($media->file_path);
        if (!$originalContent) {
            abort(404);
        }

        // リサイズ & フォーマット変換
        try {
            $manager = new ImageManager(new GdDriver());
            $image = $manager->read($originalContent);

            // 元画像が指定幅より小さければリサイズしない
            if ($image->width() > $width) {
                $image = $image->scaleDown(width: $width);
            }

            if ($format === 'webp') {
                $encoded = $image->toWebp($quality);
            } else {
                $encoded = $image->toJpeg($quality);
            }

            $optimized = (string) $encoded;
        } catch (\Exception $e) {
            \Log::warning('画像最適化失敗 (media_id=' . $mediaId . '): ' . $e->getMessage());
            // 失敗時は元画像をそのまま返す
            return $this->respondWithCache($originalContent, $media->mime_type ?? 'image/jpeg');
        }

        // キャッシュに保存
        Storage::disk($disk)->put($cachePath, $optimized);

        return $this->respondWithCache($optimized, $mime);
    }

    /**
     * GET /api/media/optimized-by-path
     *
     * thumbnail_path (フルURL) から最適化画像を返す。
     * Item.thumbnail_path はフルURLなので mediaId が不明な場合に使う。
     */
    public function showByPath(Request $request): Response
    {
        $path = $request->query('path');
        if (!$path) {
            abort(400);
        }

        // フルURLからストレージパスを抽出
        $storagePath = $this->extractStoragePath($path);
        if (!$storagePath) {
            abort(404);
        }

        $disk = $this->storage->disk();
        if (!Storage::disk($disk)->exists($storagePath)) {
            abort(404);
        }

        // パラメータ解決
        $preset = $request->query('preset');
        if ($preset && isset(self::SIZE_PRESETS[$preset])) {
            $width   = self::SIZE_PRESETS[$preset]['width'];
            $quality = self::SIZE_PRESETS[$preset]['quality'];
        } else {
            $width   = min((int) ($request->query('w', 800)), self::MAX_WIDTH);
            $quality = max(1, min(100, (int) ($request->query('q', 80))));
        }

        $format = $request->query('f', 'webp');
        if (!in_array($format, ['webp', 'jpg'], true)) {
            $format = 'webp';
        }

        $ext = $format === 'webp' ? 'webp' : 'jpg';
        $mime = $format === 'webp' ? 'image/webp' : 'image/jpeg';

        $cacheKey = md5($storagePath . "_{$width}_{$quality}_{$format}");
        $cachePath = self::CACHE_DIR . "/{$cacheKey}.{$ext}";

        if (Storage::disk($disk)->exists($cachePath)) {
            $content = Storage::disk($disk)->get($cachePath);
            return $this->respondWithCache($content, $mime);
        }

        $originalContent = Storage::disk($disk)->get($storagePath);
        if (!$originalContent) {
            abort(404);
        }

        try {
            $manager = new ImageManager(new GdDriver());
            $image = $manager->read($originalContent);

            if ($image->width() > $width) {
                $image = $image->scaleDown(width: $width);
            }

            $encoded = $format === 'webp'
                ? $image->toWebp($quality)
                : $image->toJpeg($quality);

            $optimized = (string) $encoded;
        } catch (\Exception $e) {
            \Log::warning('画像最適化失敗 (path): ' . $e->getMessage());
            return $this->respondWithCache($originalContent, 'image/jpeg');
        }

        Storage::disk($disk)->put($cachePath, $optimized);
        return $this->respondWithCache($optimized, $mime);
    }

    /**
     * Cache-Control付きレスポンスを返す
     */
    private function respondWithCache(string $content, string $mime): Response
    {
        return response($content, 200, [
            'Content-Type'  => $mime,
            'Cache-Control' => 'public, max-age=86400, s-maxage=604800, immutable',
            'ETag'          => '"' . md5($content) . '"',
        ]);
    }

    /**
     * フルURLからストレージ相対パスを抽出
     */
    private function extractStoragePath(string $url): ?string
    {
        // S3 URL: https://bucket.s3.region.amazonaws.com/items/...
        if (preg_match('#/(items/.+)$#', $url, $matches)) {
            return $matches[1];
        }

        // ローカル URL: http://localhost/storage/items/...
        if (preg_match('#/storage/(items/.+)$#', $url, $matches)) {
            return $matches[1];
        }

        return null;
    }
}
