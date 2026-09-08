<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ItemMedia;
use App\Models\SystemSetting;
use App\Services\MediaOptimizer;
use App\Services\StorageService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * 画像の最適化配信（オンデマンドリサイズ + ディスクキャッシュ）
 *
 * フロントエンドから /api/media/{mediaId}/optimized?preset=small で呼ぶと
 * リサイズ済み WebP 画像をキャッシュ付きで返す。2回目以降はキャッシュファイルを返す。
 *
 * 変換・キャッシュ・例外処理の実体は MediaOptimizer（media:warm と共通）。
 * 2026-09-08: A-12（exists 例外）/ B-8（変換の排他）/ B-6（元画像固定スイッチ）
 */
class OptimizedMediaController extends Controller
{
    public function __construct(
        private readonly StorageService $storage,
        private readonly MediaOptimizer $optimizer,
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
            return $this->redirectTo($this->storage->url($media->file_path), 0);
        }

        if ($this->bypassEnabled()) {
            return $this->redirectTo($this->storage->url($media->file_path), 300);
        }

        $p = $this->optimizer->resolveParams(
            $request->query('preset'), $request->query('w'), $request->query('q'), $request->query('f')
        );

        $variant = $this->optimizer->variant($media->file_path, $p, $media->mime_type);
        if ($variant === null) {
            abort(404);
        }

        return $this->respondWithCache($variant['content'], $variant['mime']);
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

        $storagePath = $this->optimizer->extractStoragePath($path);
        if (!$storagePath) {
            abort(404);
        }

        if ($this->bypassEnabled()) {
            // 生の path パラメータではなく、ストレージ相対パスから組み立て直す（オープンリダイレクト防止）
            return $this->redirectTo($this->storage->url($storagePath), 300);
        }

        $p = $this->optimizer->resolveParams(
            $request->query('preset'), $request->query('w'), $request->query('q'), $request->query('f')
        );

        // 旧実装は先に元画像の exists() を見て 404 にしていた。variant() はキャッシュ命中なら元画像を
        // 読まず、未命中で元画像が読めなければ null を返すので、結果は同じで S3 往復が 1 回減る。
        $variant = $this->optimizer->variant($storagePath, $p);
        if ($variant === null) {
            abort(404);
        }

        return $this->respondWithCache($variant['content'], $variant['mime']);
    }

    /**
     * B-6 縮退スイッチ: 画像最適化を迂回し、元画像（S3 直）へ 302 する。
     * php-fpm の負担は「DB/S3 に触らない 302 を返すだけ」になる。転送量は増えるので平時は OFF。
     */
    private function bypassEnabled(): bool
    {
        return (bool) SystemSetting::get('live_image_optimization_bypass', false);
    }

    private function redirectTo(?string $url, int $maxAge): Response
    {
        if (!$url) {
            abort(404);
        }

        $headers = ['Location' => $url];
        if ($maxAge > 0) {
            $headers['Cache-Control'] = "public, max-age={$maxAge}";
        }

        return response('', 302, $headers);
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
}
