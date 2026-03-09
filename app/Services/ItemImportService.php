<?php

namespace App\Services;

use App\DTOs\ImportResultDto;
use App\Models\Item;
use Illuminate\Support\Facades\Log;

class ItemImportService
{
    /** CSVの列インデックス */
    private const COL_SPECIES_NAME   = 0;
    private const COL_QUANTITY       = 1;
    private const COL_START_PRICE    = 2;
    private const COL_RESERVE_PRICE  = 3;
    private const COL_ESTIMATED      = 4;
    private const COL_BID_INCREMENT  = 5;
    private const COL_INDIVIDUAL_INFO= 6;
    private const COL_INSPECTION_INFO= 7;
    private const COL_NOTES          = 8;
    private const COL_IS_PREMIUM     = 9;
    private const COL_UNSOLD_ACTION  = 10;

    /**
     * CSVファイルを読み込んで生体を一括登録する
     */
    public function importFromCsv(string $filePath, int $auctionId, ?int $sellerProfileId = null): ImportResultDto
    {
        $content = file_get_contents($filePath);
        // BOMを除去
        $content = preg_replace('/^\xEF\xBB\xBF/', '', $content);

        $tempPath = tempnam(sys_get_temp_dir(), 'csv_import_');
        file_put_contents($tempPath, $content);

        $handle = fopen($tempPath, 'r');
        if (!$handle) {
            throw new \RuntimeException('ファイルを開けませんでした。');
        }

        try {
            $result = $this->processRows($handle, $auctionId, $sellerProfileId);
            return new ImportResultDto($result['imported'], $result['errors']);
        } finally {
            fclose($handle);
            @unlink($tempPath);
        }
    }

    private function processRows($handle, int $auctionId, ?int $sellerProfileId): array
    {
        // ヘッダー行をスキップ
        fgetcsv($handle);

        $imported      = 0;
        $errors        = [];
        $rowNumber     = 1;
        $maxItemNumber = Item::where('auction_id', $auctionId)->max('item_number') ?? 0;

        while (($row = fgetcsv($handle)) !== false) {
            $rowNumber++;

            if (empty($row[0])) {
                continue;
            }

            try {
                $validationError = $this->validateRow($row, $rowNumber);
                if ($validationError) {
                    $errors[] = $validationError;
                    continue;
                }

                $maxItemNumber++;
                $this->createItem($row, $auctionId, $sellerProfileId, $maxItemNumber);
                $imported++;
            } catch (\Exception $e) {
                Log::error("CSVインポートエラー 行{$rowNumber}: " . $e->getMessage());
                $errors[] = "行 {$rowNumber}: " . $e->getMessage();
            }
        }

        return ['imported' => $imported, 'errors' => $errors];
    }

    private function validateRow(array $row, int $rowNumber): ?string
    {
        if (count($row) < 3) {
            return "行 {$rowNumber}: データが不足しています。";
        }

        $speciesName = trim($row[self::COL_SPECIES_NAME] ?? '');
        if (empty($speciesName)) {
            return "行 {$rowNumber}: 品種名は必須です。";
        }

        $quantity = (int) trim($row[self::COL_QUANTITY] ?? '1');
        if ($quantity < 1) {
            return "行 {$rowNumber}: 匹数は1以上にしてください。";
        }

        $startPrice = (float) trim($row[self::COL_START_PRICE] ?? '0');
        if ($startPrice < 1) {
            return "行 {$rowNumber}: 開始価格は1円以上にしてください。";
        }

        return null;
    }

    private function createItem(array $row, int $auctionId, ?int $sellerProfileId, int $itemNumber): void
    {
        $unsoldAction = trim($row[self::COL_UNSOLD_ACTION] ?? 'return');
        if (!in_array($unsoldAction, ['return', 'free_pickup', 'relist'])) {
            $unsoldAction = 'return';
        }

        Item::create([
            'auction_id'        => $auctionId,
            'seller_profile_id' => $sellerProfileId,
            'item_number'       => $itemNumber,
            'species_name'      => trim($row[self::COL_SPECIES_NAME]),
            'quantity'          => (int) trim($row[self::COL_QUANTITY] ?? '1'),
            'start_price'       => (float) trim($row[self::COL_START_PRICE]),
            'current_price'     => (float) trim($row[self::COL_START_PRICE]),
            // @deprecated reserve_price, estimated_price, bid_increment はフロントエンドで未使用。CSV互換のため残存。
            'reserve_price'     => !empty($row[self::COL_RESERVE_PRICE])  ? (float) trim($row[self::COL_RESERVE_PRICE]) : null,
            'estimated_price'   => !empty($row[self::COL_ESTIMATED])      ? (float) trim($row[self::COL_ESTIMATED])     : null,
            'bid_increment'     => !empty($row[self::COL_BID_INCREMENT])  ? (float) trim($row[self::COL_BID_INCREMENT]) : 100,
            'individual_info'   => trim($row[self::COL_INDIVIDUAL_INFO]   ?? ''),
            'inspection_info'   => trim($row[self::COL_INSPECTION_INFO]   ?? ''),
            'notes'             => trim($row[self::COL_NOTES]             ?? ''),
            'is_premium'        => (bool) (int) trim($row[self::COL_IS_PREMIUM] ?? '0'),
            'unsold_action'     => $unsoldAction,
            'status'            => 'draft',
        ]);
    }
}
