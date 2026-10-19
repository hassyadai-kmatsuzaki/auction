<?php

namespace App\Services;

use App\DTOs\ImportResultDto;
use App\Models\Item;
use App\Models\SpeciesType;
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
    // 以下は後から追加した列。旧テンプレート（11列）の CSV は列が無いだけなので従来どおり取り込める。
    private const COL_SPECIES_TYPE   = 11;
    private const COL_IS_ANONYMOUS   = 12;
    private const COL_QUANTITY_UNIT  = 13;

    /** 単位列の表記 → quantity_unit */
    private const UNIT_MAP = [
        '匹' => SpeciesType::UNIT_FISH, 'fish' => SpeciesType::UNIT_FISH,
        'kg' => SpeciesType::UNIT_KG, 'ｋｇ' => SpeciesType::UNIT_KG, 'KG' => SpeciesType::UNIT_KG,
        '袋' => SpeciesType::UNIT_BAG, 'bag' => SpeciesType::UNIT_BAG,
    ];

    /** @var SpeciesType[] name/code → SpeciesType（1回の取込中はキャッシュ） */
    private array $speciesTypeIndex = [];
    private ?SpeciesType $defaultSpeciesType = null;

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

        // 種別（空なら既定＝メダカ）と単位（空なら種別の先頭単位）の整合性
        $typeRaw = trim($row[self::COL_SPECIES_TYPE] ?? '');
        $speciesType = $this->resolveSpeciesType($typeRaw);
        if (!$speciesType) {
            return "行 {$rowNumber}: 種別「{$typeRaw}」は選べません。";
        }
        $unitRaw = trim($row[self::COL_QUANTITY_UNIT] ?? '');
        $unit = $this->resolveQuantityUnit($unitRaw, $speciesType);
        if (!$unit) {
            return "行 {$rowNumber}: 種別「{$speciesType->name}」では単位「{$unitRaw}」は使えません。";
        }

        return null;
    }

    private function createItem(array $row, int $auctionId, ?int $sellerProfileId, int $itemNumber): void
    {
        $unsoldAction = trim($row[self::COL_UNSOLD_ACTION] ?? 'return');
        if (!in_array($unsoldAction, ['return', 'free_pickup', 'relist'])) {
            $unsoldAction = 'return';
        }

        $speciesType = $this->resolveSpeciesType(trim($row[self::COL_SPECIES_TYPE] ?? ''));
        $quantityUnit = $this->resolveQuantityUnit(trim($row[self::COL_QUANTITY_UNIT] ?? ''), $speciesType);

        // 出品者からの説明（individual_info）は、オークション表示用（inspection_info）が空ならそちらにも写す。
        // 参加者に見えるのは inspection_info だけ（出品申込 API と同じ扱い）。
        $individualInfo = trim($row[self::COL_INDIVIDUAL_INFO] ?? '');
        $inspectionInfo = trim($row[self::COL_INSPECTION_INFO] ?? '');
        if ($inspectionInfo === '') {
            $inspectionInfo = $individualInfo;
        }

        Item::create([
            'auction_id'        => $auctionId,
            'seller_profile_id' => $sellerProfileId,
            'item_number'       => $itemNumber,
            'species_name'      => trim($row[self::COL_SPECIES_NAME]),
            'species_type_id'   => $speciesType?->id,
            'quantity'          => (int) trim($row[self::COL_QUANTITY] ?? '1'),
            'quantity_unit'     => $quantityUnit ?? SpeciesType::UNIT_FISH,
            'start_price'       => (float) trim($row[self::COL_START_PRICE]),
            'current_price'     => (float) trim($row[self::COL_START_PRICE]),
            // @deprecated reserve_price, estimated_price, bid_increment はフロントエンドで未使用。CSV互換のため残存。
            'reserve_price'     => !empty($row[self::COL_RESERVE_PRICE])  ? (float) trim($row[self::COL_RESERVE_PRICE]) : null,
            'estimated_price'   => !empty($row[self::COL_ESTIMATED])      ? (float) trim($row[self::COL_ESTIMATED])     : null,
            'bid_increment'     => !empty($row[self::COL_BID_INCREMENT])  ? (float) trim($row[self::COL_BID_INCREMENT]) : 100,
            'individual_info'   => $individualInfo,
            'inspection_info'   => $inspectionInfo,
            'notes'             => trim($row[self::COL_NOTES]             ?? ''),
            'is_premium'        => (bool) (int) trim($row[self::COL_IS_PREMIUM] ?? '0'),
            'is_anonymous'      => (bool) (int) trim($row[self::COL_IS_ANONYMOUS] ?? '0'),
            'unsold_action'     => $unsoldAction,
            'status'            => 'draft',
        ]);
    }

    /**
     * 種別列の値（表示名 or コード）→ SpeciesType。空なら既定種別。該当なしは null。
     */
    private function resolveSpeciesType(string $raw): ?SpeciesType
    {
        if ($this->speciesTypeIndex === []) {
            foreach (SpeciesType::all() as $type) {
                $this->speciesTypeIndex[$type->name] = $type;
                $this->speciesTypeIndex[$type->code] = $type;
                if ($type->is_default) {
                    $this->defaultSpeciesType = $type;
                }
            }
            $this->defaultSpeciesType ??= $this->speciesTypeIndex['medaka'] ?? null;
        }

        if ($raw === '') {
            return $this->defaultSpeciesType;
        }

        return $this->speciesTypeIndex[$raw] ?? null;
    }

    /**
     * 単位列の値 → quantity_unit。空なら種別で許可された先頭の単位。種別で使えない単位は null。
     */
    private function resolveQuantityUnit(string $raw, ?SpeciesType $speciesType): ?string
    {
        if (!$speciesType) {
            return null;
        }
        if ($raw === '') {
            return $speciesType->allowed_quantity_units[0] ?? SpeciesType::UNIT_FISH;
        }
        $unit = self::UNIT_MAP[$raw] ?? null;
        if ($unit === null || !$speciesType->allowsQuantityUnit($unit)) {
            return null;
        }
        return $unit;
    }
}
