<?php

namespace App\Services;

use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\ImageManager;

/**
 * 画像の最適化（リサイズ + WebP/JPEG 変換）と variant キャッシュを一手に扱う。
 *
 * OptimizedMediaController（オンデマンド配信）と media:warm（開催前の事前生成）の共通部分。
 * キャッシュキーの式 md5(path_w_q_f) は旧コントローラと同一なので、S3 の cache/media に
 * 既に溜まっている variant はそのまま使われる。
 *
 * - A-12 (2026-09-08): exists()/get() の Flysystem 例外を握って「無いもの」として扱う（1枚の判定失敗で 500 にしない）
 * - B-8  (2026-09-08): 同じ variant の変換は Cache::lock で 1 プロセスに限定。待ちきれなければ元画像を返す
 */
class MediaOptimizer
{
    public const SIZE_PRESETS = [
        'thumb'  => ['width' => 200,  'quality' => 70],
        'small'  => ['width' => 400,  'quality' => 75],
        'medium' => ['width' => 800,  'quality' => 80],
        'large'  => ['width' => 1200, 'quality' => 85],
    ];

    public const MAX_WIDTH = 1600;

    public const CACHE_DIR = 'cache/media';

    public function __construct(private readonly StorageService $storage) {}

    /**
     * preset / w / q / f を幅・品質・形式に正規化する
     *
     * @return array{width:int,quality:int,format:string,ext:string,mime:string}
     */
    public function resolveParams(?string $preset, $w = null, $q = null, ?string $f = null): array
    {
        if ($preset && isset(self::SIZE_PRESETS[$preset])) {
            $width   = self::SIZE_PRESETS[$preset]['width'];
            $quality = self::SIZE_PRESETS[$preset]['quality'];
        } else {
            $width   = min((int) ($w ?? 800), self::MAX_WIDTH);
            $quality = max(1, min(100, (int) ($q ?? 80)));
        }

        $format = in_array($f, ['webp', 'jpg'], true) ? $f : 'webp';

        return [
            'width'   => $width,
            'quality' => $quality,
            'format'  => $format,
            'ext'     => $format === 'webp' ? 'webp' : 'jpg',
            'mime'    => $format === 'webp' ? 'image/webp' : 'image/jpeg',
        ];
    }

    /** キャッシュファイルのパス（式は旧実装と同一） */
    public function cachePath(string $storagePath, array $p): string
    {
        $key = md5($storagePath . "_{$p['width']}_{$p['quality']}_{$p['format']}");

        return self::CACHE_DIR . "/{$key}.{$p['ext']}";
    }

    /**
     * フルURL（S3 / ローカル）または相対パスからストレージ相対パスを取り出す
     */
    public function extractStoragePath(string $url): ?string
    {
        if (str_starts_with($url, 'items/')) {
            return $url;
        }
        // S3 URL: https://bucket.s3.region.amazonaws.com/items/...
        if (preg_match('#/(items/.+)$#', $url, $m)) {
            return $m[1];
        }
        // ローカル URL: http://localhost/storage/items/...
        if (preg_match('#/storage/(items/.+)$#', $url, $m)) {
            return $m[1];
        }

        return null;
    }

    /**
     * A-12: exists() が S3 の一時失敗で UnableToCheckFileExistence を投げても 500 にしない
     */
    public function exists(string $disk, string $path): bool
    {
        try {
            return Storage::disk($disk)->exists($path);
        } catch (\Throwable $e) {
            Log::warning('media.exists_failed', ['disk' => $disk, 'path' => $path, 'error' => $e->getMessage()]);
            return false;
        }
    }

    /** get() の例外も同様に「読めなかった」として null */
    public function read(string $disk, string $path): ?string
    {
        try {
            $content = Storage::disk($disk)->get($path);
            return ($content === null || $content === '') ? null : $content;
        } catch (\Throwable $e) {
            Log::warning('media.read_failed', ['disk' => $disk, 'path' => $path, 'error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * variant を返す。元画像が読めなければ null。
     *
     * @return array{content:string,mime:string,source:string}|null  source は cache / generated / original
     */
    public function variant(string $storagePath, array $p, ?string $originalMime = null): ?array
    {
        $disk      = $this->storage->disk();
        $cachePath = $this->cachePath($storagePath, $p);

        if ($this->exists($disk, $cachePath)) {
            $content = $this->read($disk, $cachePath);
            if ($content !== null) {
                return ['content' => $content, 'mime' => $p['mime'], 'source' => 'cache'];
            }
        }

        // B-8: 変換は 1 プロセスだけ。他プロセスは完成を待ち、待ちきれなければ元画像を返す。
        //   旧実装は 500 人が同じ商品を同時に開くと php-fpm 全員が同じ画像を GD 変換していた
        //   （8/28 11:47 に 95 人で CPU 96.9%）。
        $lock = Cache::lock('media:convert:' . md5($cachePath), (int) config('media.convert_lock_seconds', 20));
        $wait = (int) config('media.convert_wait_seconds', 8);

        try {
            return $lock->block($wait, function () use ($disk, $cachePath, $storagePath, $p, $originalMime) {
                // 待っている間に他プロセスが作り終えていればそれを返す
                if ($this->exists($disk, $cachePath)) {
                    $content = $this->read($disk, $cachePath);
                    if ($content !== null) {
                        return ['content' => $content, 'mime' => $p['mime'], 'source' => 'cache'];
                    }
                }

                $original = $this->read($disk, $storagePath);
                if ($original === null) {
                    return null;
                }

                $optimized = $this->convert($original, $p);
                if ($optimized === null) {
                    return ['content' => $original, 'mime' => $originalMime ?: 'image/jpeg', 'source' => 'original'];
                }

                try {
                    Storage::disk($disk)->put($cachePath, $optimized);
                } catch (\Throwable $e) {
                    Log::warning('media.cache_put_failed', ['disk' => $disk, 'path' => $cachePath, 'error' => $e->getMessage()]);
                }

                return ['content' => $optimized, 'mime' => $p['mime'], 'source' => 'generated'];
            });
        } catch (LockTimeoutException $e) {
            Log::info('media.convert_wait_timeout', ['path' => $storagePath, 'wait' => $wait]);
            $original = $this->read($disk, $storagePath);
            if ($original === null) {
                return null;
            }
            return ['content' => $original, 'mime' => $originalMime ?: 'image/jpeg', 'source' => 'original'];
        }
    }

    /**
     * B-9: 指定プリセットの variant を無ければ作る（media:warm 用）
     *
     * @param  string[] $presets
     * @return array<string,string>  preset => cached | generated | original | missing
     */
    public function warm(string $storagePath, array $presets): array
    {
        $result = [];
        foreach ($presets as $preset) {
            $p = $this->resolveParams($preset);
            $variant = $this->variant($storagePath, $p);
            $source  = $variant['source'] ?? 'missing';
            $result[$preset] = $source === 'cache' ? 'cached' : $source;
        }

        return $result;
    }

    /** GD でリサイズ + 変換。失敗時は null（呼び出し側が元画像で代替する） */
    private function convert(string $original, array $p): ?string
    {
        try {
            $manager = new ImageManager(new GdDriver());
            $image   = $manager->read($original);

            if ($image->width() > $p['width']) {
                $image = $image->scaleDown(width: $p['width']);
            }

            $encoded = $p['format'] === 'webp' ? $image->toWebp($p['quality']) : $image->toJpeg($p['quality']);

            return (string) $encoded;
        } catch (\Throwable $e) {
            Log::warning('画像最適化失敗: ' . $e->getMessage());
            return null;
        }
    }
}
