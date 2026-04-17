<?php

namespace App\Actions\Item;

use App\DTOs\AuctionResultDto;
use App\Jobs\ProcessItemVideoJob;
use App\Models\Item;
use App\Models\ItemMedia;
use App\Services\StorageService;
use App\Services\VideoProcessingService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

class UploadMediaAction
{
    public function __construct(
        private readonly StorageService $storage,
        private readonly VideoProcessingService $videoProcessing,
    ) {}

    public function execute(
        Item         $item,
        UploadedFile $file,
        string       $mediaType,
        bool         $isThumbnail = false,
    ): AuctionResultDto {
        // 動画はサムネイルにしない
        if ($mediaType !== 'image') {
            $isThumbnail = false;
        }

        $extension = $file->getClientOriginalExtension();
        $filename  = "items/{$item->auction_id}/{$item->id}/" . Str::uuid() . ".{$extension}";
        $disk      = $this->storage->disk();

        try {
            if ($disk === 's3') {
                $path = \Illuminate\Support\Facades\Storage::disk('s3')->putFileAs('', $file, $filename, 'public');
            } else {
                $directory = dirname($filename);
                if (!\Illuminate\Support\Facades\Storage::disk('public')->exists($directory)) {
                    \Illuminate\Support\Facades\Storage::disk('public')->makeDirectory($directory);
                }
                $path = \Illuminate\Support\Facades\Storage::disk('public')->putFileAs('', $file, $filename);
            }

            if (!$path) {
                return AuctionResultDto::failure('ファイルの保存に失敗しました。');
            }
        } catch (\Exception $e) {
            \Log::error('メディアアップロードエラー: ' . $e->getMessage());
            return AuctionResultDto::failure('ファイルのアップロードに失敗しました: ' . $e->getMessage());
        }

        if ($isThumbnail) {
            ItemMedia::where('item_id', $item->id)->update(['is_thumbnail' => false]);
            $item->update(['thumbnail_path' => $this->storage->url($path)]);
        }

        $dbMediaType   = $mediaType === 'image' ? 'photo_other' : 'video_top';
        $displayOrder  = ItemMedia::where('item_id', $item->id)->max('display_order') ?? 0;

        // 動画の場合はポスター画像を同期生成（一覧・サムネで即使うため）
        $posterPath = null;
        if ($mediaType === 'video') {
            $posterPath = $this->videoProcessing->generatePoster($path);
        }

        $media = ItemMedia::create([
            'item_id'       => $item->id,
            'media_type'    => $dbMediaType,
            'file_path'     => $path,
            'poster_path'   => $posterPath,
            'is_processed'  => $mediaType !== 'video',
            'file_name'     => $file->getClientOriginalName(),
            'file_size'     => $file->getSize(),
            'mime_type'     => $file->getMimeType(),
            'is_thumbnail'  => $isThumbnail,
            'display_order' => $displayOrder + 1,
        ]);

        // 動画の圧縮はキューで非同期実行
        if ($mediaType === 'video') {
            ProcessItemVideoJob::dispatch($media->id);
        }

        return AuctionResultDto::success('ファイルをアップロードしました。', [
            'media' => [
                'id'            => $media->id,
                'media_type'    => $media->media_type,
                'file_path'     => $media->file_path,
                'file_url'      => $this->storage->url($media->file_path),
                'poster_path'   => $media->poster_path,
                'poster_url'    => $this->storage->url($media->poster_path),
                'is_processed'  => $media->is_processed,
                'is_thumbnail'  => $media->is_thumbnail,
                'display_order' => $media->display_order,
            ],
        ]);
    }
}
