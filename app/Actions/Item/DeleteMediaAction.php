<?php

namespace App\Actions\Item;

use App\DTOs\AuctionResultDto;
use App\Models\Item;
use App\Models\ItemMedia;
use App\Services\StorageService;

class DeleteMediaAction
{
    public function __construct(
        private readonly StorageService $storage,
    ) {}

    public function execute(Item $item, ItemMedia $media): AuctionResultDto
    {
        // サムネイルだった場合はアイテムのサムネイルパスもクリア
        if ($media->is_thumbnail) {
            $item->update(['thumbnail_path' => null]);
        }

        // ストレージからファイル削除
        if ($media->file_path) {
            $this->storage->delete($media->file_path);
        }

        $media->delete();

        return AuctionResultDto::success('メディアを削除しました。');
    }
}
