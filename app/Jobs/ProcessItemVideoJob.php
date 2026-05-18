<?php

namespace App\Jobs;

use App\Models\ItemMedia;
use App\Services\StorageService;
use App\Services\VideoProcessingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ProcessItemVideoJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 1800;

    public function __construct(public int $mediaId)
    {
        $this->onQueue('media');
    }

    public function handle(VideoProcessingService $video, StorageService $storage): void
    {
        $media = ItemMedia::find($this->mediaId);
        if (!$media || !$media->file_path) {
            return;
        }
        if ($media->is_processed) {
            return;
        }

        $this->writeStatus('processing');

        $originalPath = $media->file_path;
        $encodedPath  = $video->compress($originalPath);

        if (!$encodedPath) {
            Log::warning('動画圧縮スキップ（失敗）', ['media_id' => $media->id]);
            $this->writeStatus('failed', 'compress_returned_null');
            return;
        }

        $media->update([
            'file_path'    => $encodedPath,
            'mime_type'    => 'video/mp4',
            'file_size'    => Storage::disk($storage->disk())->size($encodedPath),
            'is_processed' => true,
        ]);

        if ($originalPath !== $encodedPath) {
            Storage::disk($storage->disk())->delete($originalPath);
        }

        $this->writeStatus('done');
    }

    public function failed(\Throwable $e): void
    {
        // tries 枯渇時の最終的な失敗ハンドラ。
        $this->writeStatus('failed', $e->getMessage());
    }

    /**
     * Redis に処理状態を書き込む。Redis 失敗は圧縮処理本体を巻き込まない。
     * 観測用APIから読まれる: docs/api/internal-item-media-upload.md
     */
    private function writeStatus(string $status, ?string $reason = null): void
    {
        try {
            Cache::store('redis')->put(
                "media:proc:{$this->mediaId}",
                [
                    'status' => $status,
                    'reason' => $reason,
                    'at'     => now()->toIso8601String(),
                ],
                now()->addDays(30),
            );
        } catch (\Throwable $e) {
            Log::warning('ProcessItemVideoJob: redis write failed', [
                'media_id' => $this->mediaId,
                'status'   => $status,
                'error'    => $e->getMessage(),
            ]);
        }
    }
}
