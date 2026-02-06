<?php

namespace App\Traits;

use Illuminate\Support\Facades\Storage;

trait MediaUrlTrait
{
    /**
     * ファイルパスからフルURLを生成
     */
    protected function resolveMediaUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        // 既にフルURLの場合はそのまま返す
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        // S3が有効か判定
        $key = config('filesystems.disks.s3.key');
        $bucket = config('filesystems.disks.s3.bucket');

        if (!empty($key) && !empty($bucket) && class_exists(\Aws\S3\S3Client::class)) {
            return Storage::disk('s3')->url($path);
        }

        // publicディスクの場合
        return config('app.url') . '/storage/' . $path;
    }

    /**
     * メディアコレクションをURL付きの配列に変換
     */
    protected function transformMedia($mediaCollection): array
    {
        return $mediaCollection->map(function ($m) {
            return [
                'id' => $m->id,
                'media_type' => $m->media_type,
                'file_path' => $m->file_path,
                'file_url' => $this->resolveMediaUrl($m->file_path),
                'file_name' => $m->file_name,
                'mime_type' => $m->mime_type,
                'is_thumbnail' => $m->is_thumbnail,
                'display_order' => $m->display_order,
                'duration' => $m->duration,
            ];
        })->toArray();
    }
}
