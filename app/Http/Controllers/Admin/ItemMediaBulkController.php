<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\Item;
use App\Models\ItemMedia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use ZipArchive;

class ItemMediaBulkController extends Controller
{
    private const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    private const MAX_FILE_SIZE_MB = 10;

    public function bulkUpload(Request $request, int $auctionId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:zip|max:512000',
        ], [
            'file.required' => 'ZIPファイルを選択してください。',
            'file.mimes'    => 'ZIPファイルのみアップロード可能です。',
            'file.max'      => 'ファイルサイズは500MB以下にしてください。',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        Auction::findOrFail($auctionId);

        $items = Item::where('auction_id', $auctionId)
            ->pluck('id', 'item_number')
            ->toArray();

        if (empty($items)) {
            return response()->json([
                'success' => false,
                'message' => 'このオークションに生体が登録されていません。先に生体を登録してください。',
            ], 400);
        }

        $zipFile = $request->file('file');
        $zip = new ZipArchive();
        $tempDir = storage_path('app/temp/bulk-upload-' . uniqid());

        if ($zip->open($zipFile->getRealPath()) !== true) {
            return response()->json(['success' => false, 'message' => 'ZIPファイルを開けませんでした。'], 400);
        }

        @mkdir($tempDir, 0755, true);
        $zip->extractTo($tempDir);
        $zip->close();

        $results = [];
        $errors = [];
        $totalFiles = 0;
        $uploaded = 0;

        $allFiles = $this->collectFiles($tempDir);

        foreach ($allFiles as $filePath) {
            $totalFiles++;
            $filename = basename($filePath);
            $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

            if (!in_array($ext, self::ALLOWED_EXTENSIONS)) {
                $errors[] = "'{$filename}' は対応していないファイル形式です（対応: " . implode(', ', self::ALLOWED_EXTENSIONS) . "）";
                continue;
            }

            $fileSize = filesize($filePath);
            if ($fileSize > self::MAX_FILE_SIZE_MB * 1024 * 1024) {
                $errors[] = "'{$filename}' のサイズが上限（" . self::MAX_FILE_SIZE_MB . "MB）を超えています";
                continue;
            }

            $parsed = $this->parseFilename($filename);
            if (!$parsed) {
                $errors[] = "'{$filename}' のファイル名が命名規則に合いません（例: 001_1.jpg）";
                continue;
            }

            $itemNumber = $parsed['item_number'];
            $sequence = $parsed['sequence'];

            if (!isset($items[$itemNumber])) {
                $errors[] = "'{$filename}' に対応する生体番号 {$itemNumber} が見つかりません";
                continue;
            }

            $itemId = $items[$itemNumber];

            try {
                $storagePath = "items/{$auctionId}/{$itemId}/" . uniqid() . ".{$ext}";
                Storage::disk('public')->put($storagePath, file_get_contents($filePath));

                $existingThumbnail = ItemMedia::where('item_id', $itemId)->where('is_thumbnail', true)->exists();
                $isThumbnail = !$existingThumbnail && $sequence === 1;

                $maxOrder = ItemMedia::where('item_id', $itemId)->max('display_order') ?? 0;

                ItemMedia::create([
                    'item_id'       => $itemId,
                    // ZIP 一括アップロードでは sequence=1 を「上面」、それ以降を「その他」に振る。
                    // item_media.media_type は enum なのでマスタ値を厳格に渡す。
                    'media_type'    => $sequence === 1 ? 'photo_top' : 'photo_other',
                    'file_path'     => $storagePath,
                    'file_name'     => $filename,
                    'mime_type'     => 'image/' . ($ext === 'jpg' ? 'jpeg' : $ext),
                    'file_size'     => $fileSize,
                    'is_thumbnail'  => $isThumbnail,
                    'display_order' => $maxOrder + 1,
                ]);

                if ($isThumbnail) {
                    Item::where('id', $itemId)->update([
                        'thumbnail_path' => Storage::disk('public')->url($storagePath),
                    ]);
                }

                if (!isset($results[$itemNumber])) {
                    $results[$itemNumber] = 0;
                }
                $results[$itemNumber]++;
                $uploaded++;
            } catch (\Exception $e) {
                Log::error("Bulk upload error for {$filename}: " . $e->getMessage());
                $errors[] = "'{$filename}' のアップロードに失敗しました";
            }
        }

        $this->deleteDirectory($tempDir);

        $resultsSummary = [];
        foreach ($results as $itemNumber => $count) {
            $resultsSummary[] = ['item_number' => $itemNumber, 'uploaded_count' => $count];
        }

        return response()->json([
            'success' => true,
            'message' => "{$uploaded}件の画像をアップロードしました。",
            'data' => [
                'total_files' => $totalFiles,
                'uploaded'    => $uploaded,
                'skipped'     => $totalFiles - $uploaded,
                'errors'      => $errors,
                'results'     => $resultsSummary,
            ],
        ]);
    }

    private function parseFilename(string $filename): ?array
    {
        $name = pathinfo($filename, PATHINFO_FILENAME);

        if (preg_match('/^(\d+)_(\d+)$/', $name, $matches)) {
            return [
                'item_number' => (int) $matches[1],
                'sequence'    => (int) $matches[2],
            ];
        }

        return null;
    }

    private function collectFiles(string $dir): array
    {
        $files = [];
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if ($file->isFile() && !str_starts_with($file->getFilename(), '.')) {
                $files[] = $file->getRealPath();
            }
        }

        sort($files);
        return $files;
    }

    private function deleteDirectory(string $dir): void
    {
        if (!is_dir($dir)) return;

        $items = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($items as $item) {
            $item->isDir() ? @rmdir($item->getRealPath()) : @unlink($item->getRealPath());
        }

        @rmdir($dir);
    }
}
