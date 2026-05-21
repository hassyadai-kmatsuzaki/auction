<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;

/**
 * ファイルストレージを抽象化するサービス
 *
 * Admin/ItemController と Seller/ItemController に重複していた
 * getStorageDisk() / getFileUrl() を一本化
 */
class StorageService
{
    private ?string $resolvedDisk = null;

    /**
     * 使用すべきストレージディスクを返す（'s3' or 'public'）
     */
    public function disk(): string
    {
        if ($this->resolvedDisk !== null) {
            return $this->resolvedDisk;
        }

        // 認証情報は IAM Role / env のどちらでも AWS SDK が自動解決する。
        // bucket と SDK の存在だけ確認すれば S3 を選んでよい。
        $bucket = config('filesystems.disks.s3.bucket');

        if (!empty($bucket) && class_exists(\Aws\S3\S3Client::class)) {
            return $this->resolvedDisk = 's3';
        }

        return $this->resolvedDisk = 'public';
    }

    /**
     * ファイルパスからアクセス可能なURLを生成する
     */
    public function url(?string $path): ?string
    {
        if (empty($path)) {
            return null;
        }

        // 既にフルURLであればそのまま返す
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        if ($this->disk() === 's3') {
            return Storage::disk('s3')->url($path);
        }

        return config('app.url') . '/storage/' . $path;
    }

    /**
     * ファイルをストレージに保存してパスを返す
     */
    public function put(string $directory, $file): string
    {
        return Storage::disk($this->disk())->put($directory, $file);
    }

    /**
     * ファイルを削除する
     */
    public function delete(string $path): bool
    {
        return Storage::disk($this->disk())->delete($path);
    }
}
