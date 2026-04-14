<?php

namespace App\Actions\Auction;

use App\Models\Auction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * 終了オークションのログを _archive テーブル群へ退避する。
 *
 * 対象テーブル（本番 → アーカイブ）:
 *   - bid_events         → bid_events_archive
 *   - price_events       → price_events_archive
 *   - bid_participants   → bid_participants_archive
 *   - bid_limit_prices   → bid_limit_prices_archive
 *   - lane_items         → lane_items_archive
 *
 * 処理は以下の順でトランザクション内実行:
 *   1. 対象オークションの item_id 群を取得
 *   2. 各テーブルについて INSERT ... SELECT で退避
 *   3. 件数を検証
 *   4. 元テーブルから DELETE
 *   5. auction_archive_logs に監査レコードを残す
 *
 * items / auctions 自体は削除しない（落札実績・決済・税務参照が残るため）。
 */
class ArchiveAuctionAction
{
    private const CHUNK_SIZE = 5000;

    /**
     * @param  Auction  $auction   対象オークション（status='finished' 必須）
     * @param  array{force?:bool, dry_run?:bool, executed_by?:int|null, note?:string|null} $options
     * @return array{
     *   success: bool,
     *   message: string,
     *   counts: array<string,int>,
     *   dry_run: bool,
     * }
     */
    public function execute(Auction $auction, array $options = []): array
    {
        $force = $options['force'] ?? false;
        $dryRun = $options['dry_run'] ?? false;
        $executedBy = $options['executed_by'] ?? null;
        $note = $options['note'] ?? null;

        if ($auction->status !== 'finished' && !$force) {
            return [
                'success' => false,
                'message' => 'status=finished のオークションのみ退避できます（--force で強制可）。',
                'counts' => [],
                'dry_run' => $dryRun,
            ];
        }

        // 既にアーカイブ済みか判定
        $alreadyArchived = DB::table('auction_archive_logs')
            ->where('auction_id', $auction->id)
            ->where('operation', 'archive')
            ->exists();
        if ($alreadyArchived && !$force) {
            return [
                'success' => false,
                'message' => 'このオークションは既にアーカイブ済みです（--force で再実行可）。',
                'counts' => [],
                'dry_run' => $dryRun,
            ];
        }

        $itemIds = $auction->items()->pluck('id')->all();
        if (empty($itemIds)) {
            return [
                'success' => true,
                'message' => '対象アイテムが0件のためスキップしました。',
                'counts' => array_fill_keys(array_keys($this->tableMap()), 0),
                'dry_run' => $dryRun,
            ];
        }

        $counts = [];
        foreach ($this->tableMap() as $source => $archive) {
            $counts[$source] = $this->countForItems($source, $itemIds);
        }

        if ($dryRun) {
            return [
                'success' => true,
                'message' => '[DRY-RUN] 退避対象件数を算出しました（実行はしていません）。',
                'counts' => $counts,
                'dry_run' => true,
            ];
        }

        DB::beginTransaction();
        try {
            foreach ($this->tableMap() as $source => $archive) {
                $this->copyToArchive($source, $archive, $auction->id, $itemIds);
            }

            // 削除は逆順（依存関係がある場合のため。実際はFKなしだが安全側）
            foreach (array_reverse($this->tableMap()) as $source => $archive) {
                $this->chunkedDelete($source, $itemIds);
            }

            DB::table('auction_archive_logs')->insert([
                'auction_id' => $auction->id,
                'operation' => 'archive',
                'bid_events_count' => $counts['bid_events'] ?? 0,
                'price_events_count' => $counts['price_events'] ?? 0,
                'bid_participants_count' => $counts['bid_participants'] ?? 0,
                'bid_limit_prices_count' => $counts['bid_limit_prices'] ?? 0,
                'lane_items_count' => $counts['lane_items'] ?? 0,
                'executed_by' => $executedBy,
                'note' => $note,
                'executed_at' => now(),
            ]);

            DB::commit();

            Log::info('Auction archived', [
                'auction_id' => $auction->id,
                'counts' => $counts,
            ]);

            return [
                'success' => true,
                'message' => "オークション #{$auction->id} のログを退避しました。",
                'counts' => $counts,
                'dry_run' => false,
            ];
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Auction archive failed', [
                'auction_id' => $auction->id,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * @return array<string,string> source => archive
     */
    private function tableMap(): array
    {
        return [
            'bid_events' => 'bid_events_archive',
            'price_events' => 'price_events_archive',
            'bid_participants' => 'bid_participants_archive',
            'bid_limit_prices' => 'bid_limit_prices_archive',
            'lane_items' => 'lane_items_archive',
        ];
    }

    private function countForItems(string $table, array $itemIds): int
    {
        return DB::table($table)->whereIn('item_id', $itemIds)->count();
    }

    /**
     * INSERT INTO archive SELECT * FROM source WHERE item_id IN (...) をチャンクで実行
     */
    private function copyToArchive(string $source, string $archive, int $auctionId, array $itemIds): void
    {
        $columns = $this->sourceColumns($source);
        $selectList = array_map(fn ($c) => "`{$c}`", $columns);
        $insertColumns = array_merge($columns, ['archived_auction_id', 'archived_at']);
        $insertList = array_map(fn ($c) => "`{$c}`", $insertColumns);
        $archivedAt = now()->toDateTimeString();

        foreach (array_chunk($itemIds, self::CHUNK_SIZE) as $chunk) {
            $placeholders = rtrim(str_repeat('?,', count($chunk)), ',');
            $sql = sprintf(
                'INSERT INTO `%s` (%s) SELECT %s, ?, ? FROM `%s` WHERE `item_id` IN (%s)',
                $archive,
                implode(',', $insertList),
                implode(',', $selectList),
                $source,
                $placeholders,
            );
            $bindings = array_merge([$auctionId, $archivedAt], $chunk);
            DB::statement($sql, $bindings);
        }
    }

    private function chunkedDelete(string $table, array $itemIds): void
    {
        foreach (array_chunk($itemIds, self::CHUNK_SIZE) as $chunk) {
            DB::table($table)->whereIn('item_id', $chunk)->delete();
        }
    }

    /**
     * 元テーブルのカラム一覧（archived_auction_id / archived_at を除く）
     */
    private function sourceColumns(string $table): array
    {
        return match ($table) {
            'bid_events' => [
                'id', 'item_id', 'user_id', 'event_type', 'price_at_event',
                'metadata', 'ip_address', 'user_agent', 'created_at',
            ],
            'price_events' => [
                'id', 'item_id', 'old_price', 'new_price', 'reason',
                'active_bidder_count', 'triggered_by', 'metadata', 'created_at',
            ],
            'bid_participants' => [
                'id', 'item_id', 'user_id', 'is_active', 'activated_at',
                'deactivated_at', 'ip_address', 'user_agent', 'created_at', 'updated_at',
            ],
            'bid_limit_prices' => [
                'id', 'item_id', 'user_id', 'limit_price', 'is_triggered',
                'triggered_at', 'created_at', 'updated_at',
            ],
            'lane_items' => [
                'id', 'lane_id', 'item_id', 'sequence_order', 'started_at',
                'finished_at', 'duration_seconds', 'created_at', 'updated_at',
            ],
            default => throw new \InvalidArgumentException("Unknown source table: {$table}"),
        };
    }
}
