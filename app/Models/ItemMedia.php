<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Facades\Storage;

class ItemMedia extends BaseModel
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'item_media';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'item_id',
        'media_type',
        'file_path',
        'poster_path',
        'original_path',
        'is_processed',
        'file_name',
        'file_size',
        'mime_type',
        'duration',
        'width',
        'height',
        'display_order',
        'is_thumbnail',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'duration' => 'integer',
        'file_size' => 'integer',
        'width' => 'integer',
        'height' => 'integer',
        'display_order' => 'integer',
        'is_thumbnail' => 'boolean',
        'is_processed' => 'boolean',
    ];

    /**
     * シリアライズ時に file_url / poster_url を自動追加
     */
    protected $appends = ['file_url', 'poster_url'];

    /**
     * file_url アクセサ - file_pathからフルURLを生成
     */
    public function getFileUrlAttribute(): ?string
    {
        if (!$this->file_path) {
            return null;
        }

        // 既にフルURLの場合はそのまま返す
        if (str_starts_with($this->file_path, 'http://') || str_starts_with($this->file_path, 'https://')) {
            return $this->file_path;
        }

        // S3が有効か判定
        $key = config('filesystems.disks.s3.key');
        $bucket = config('filesystems.disks.s3.bucket');

        if (!empty($key) && !empty($bucket) && class_exists(\Aws\S3\S3Client::class)) {
            return Storage::disk('s3')->url($this->file_path);
        }

        // publicディスクの場合
        return config('app.url') . '/storage/' . $this->file_path;
    }

    /**
     * poster_url アクセサ - poster_path からフルURLを生成（動画ポスター画像用）
     */
    public function getPosterUrlAttribute(): ?string
    {
        if (!$this->poster_path) {
            return null;
        }

        if (str_starts_with($this->poster_path, 'http://') || str_starts_with($this->poster_path, 'https://')) {
            return $this->poster_path;
        }

        $key = config('filesystems.disks.s3.key');
        $bucket = config('filesystems.disks.s3.bucket');

        if (!empty($key) && !empty($bucket) && class_exists(\Aws\S3\S3Client::class)) {
            return Storage::disk('s3')->url($this->poster_path);
        }

        return config('app.url') . '/storage/' . $this->poster_path;
    }

    /**
     * 商品とのリレーション
     */
    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
