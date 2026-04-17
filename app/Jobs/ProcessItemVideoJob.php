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
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ProcessItemVideoJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 1800;

    public function __construct(public int $mediaId)
    {
        $this->onQueue('default');
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

        $originalPath = $media->file_path;
        $encodedPath  = $video->compress($originalPath);

        if (!$encodedPath) {
            Log::warning('動画圧縮スキップ（失敗）', ['media_id' => $media->id]);
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
    }
}
