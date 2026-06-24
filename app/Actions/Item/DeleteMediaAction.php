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
        // サムネイルだった場合はアイテムのサムネイルパスをクリア。
        // 手動指定だった写真が消えたら手動フラグも解除し、再び自動サムネ適用の対象に戻す。
        if ($media->is_thumbnail) {
            $item->update(['thumbnail_path' => null, 'thumbnail_is_manual' => false]);
        }

        // ストレージからファイル削除（本体・ポスター・オリジナルすべて）
        foreach ([$media->file_path, $media->poster_path, $media->original_path] as $path) {
            if ($path) {
                $this->storage->delete($path);
            }
        }

        $media->delete();

        return AuctionResultDto::success('メディアを削除しました。');
    }
}
