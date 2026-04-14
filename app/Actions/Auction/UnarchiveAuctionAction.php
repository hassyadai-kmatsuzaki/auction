<?php

namespace App\Actions\Auction;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * アーカイブ済みオークションのログを _archive テーブル群から本番テーブルへ戻す。
 *
 * ユースケース:
 *   - 監査・紛争対応で過去の入札履歴を画面表示する必要が出たとき
 *   - ArchiveAuctionAction でアーカイブしたデータを巻き戻すとき
 *
 * 注意:
 *   - 元の id を復元するため、本番テーブルに同一IDが残っている場合は失敗する
 *   - 本番側の items レコードが残っていることが前提（items自体はアーカイブしないので通常OK）
 */
class UnarchiveAuctionAction
{
    private const CHUNK_SIZE = 5000;

    /**
     * @param  int  $auctionId
     * @param  array{executed_by?:int|null, note?:string|null}  $options
     * @return array{success:bool, message:string, counts:array<string,int>}
     */
    public function execute(int $auctionId, array $options = []): array
    {
        $executedBy = $options['executed_by'] ?? null;
        $note = $options['note'] ?? null;

        $counts = [];
        foreach ($this->archiveTables() as $archive) {
            $counts[$archive] = DB::table($archive)
                ->where('archived_auction_id', $auctionId)
                ->count();
        }

        if (array_sum($counts) === 0) {
            return [
                'success' => false,
                'message' => "オークション #{$auctionId} のアーカイブデータが見つかりません。",
                'counts' => $counts,
            ];
        }

        // 事前衝突チェック：本番側に同一IDまたはUNIQUE制約違反になるレコードがあれば中止
        $conflicts = $this->detectConflicts($auctionId);
        if (!empty($conflicts)) {
            return [
                'success' => false,
                'message' => '本番テーブルに既存レコードが存在するため復元できません: ' . implode(', ', $conflicts),
                'counts' => $counts,
            ];
        }

        DB::beginTransaction();
        try {
            foreach ($this->tableMap() as $source => $archive) {
                $this->restoreToSource($archive, $source, $auctionId);
            }

            foreach ($this->archiveTables() as $archive) {
                $this->chunkedDeleteArchive($archive, $auctionId);
            }

            DB::table('auction_archive_logs')->insert([
                'auction_id' => $auctionId,
                'operation' => 'unarchive',
                'bid_events_count' => $counts['bid_events_archive'] ?? 0,
                'price_events_count' => $counts['price_events_archive'] ?? 0,
                'bid_participants_count' => $counts['bid_participants_archive'] ?? 0,
                'bid_limit_prices_count' => $counts['bid_limit_prices_archive'] ?? 0,
                'lane_items_count' => $counts['lane_items_archive'] ?? 0,
                'executed_by' => $executedBy,
                'note' => $note,
                'executed_at' => now(),
            ]);

            DB::commit();

            Log::info('Auction unarchived', ['auction_id' => $auctionId, 'counts' => $counts]);

            return [
                'success' => true,
                'message' => "オークション #{$auctionId} のログを本番テーブルに復元しました。",
                'counts' => $counts,
            ];
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Auction unarchive failed', [
                'auction_id' => $auctionId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

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

    private function archiveTables(): array
    {
        return array_values($this->tableMap());
    }

    /**
     * 復元前に本番テーブル側で衝突しそうな制約を検査
     * @return string[] 衝突が検出された説明（空なら安全）
     */
    private function detectConflicts(int $auctionId): array
    {
        $issues = [];

        foreach ($this->tableMap() as $source => $archive) {
            // 主キー衝突：アーカイブ側の id が本番側に残っていないか
            $dupIds = DB::table($source)
                ->whereIn('id', function ($q) use ($archive, $auctionId) {
                    $q->select('id')->from($archive)->where('archived_auction_id', $auctionId);
                })
                ->count();
            if ($dupIds > 0) {
                $issues[] = "{$source} に同一PKレコードが {$dupIds} 件";
            }
        }

        // lane_items は UNIQUE(item_id) もあるので追加チェック
        $uniqLaneItems = DB::table('lane_items')
            ->whereIn('item_id', function ($q) use ($auctionId) {
                $q->select('item_id')->from('lane_items_archive')->where('archived_auction_id', $auctionId);
            })
            ->count();
        if ($uniqLaneItems > 0) {
            $issues[] = "lane_items のUNIQUE(item_id)制約と衝突 {$uniqLaneItems} 件";
        }

        // bid_participants / bid_limit_prices は UNIQUE(item_id, user_id)
        foreach (['bid_participants', 'bid_limit_prices'] as $t) {
            $archive = "{$t}_archive";
            $exists = DB::table($t)
                ->whereExists(function ($q) use ($t, $archive, $auctionId) {
                    $q->select(DB::raw(1))
                        ->from($archive)
                        ->where('archived_auction_id', $auctionId)
                        ->whereColumn("{$archive}.item_id", "{$t}.item_id")
                        ->whereColumn("{$archive}.user_id", "{$t}.user_id");
                })
                ->count();
            if ($exists > 0) {
                $issues[] = "{$t} のUNIQUE(item_id,user_id)制約と衝突 {$exists} 件";
            }
        }

        return $issues;
    }

    private function restoreToSource(string $archive, string $source, int $auctionId): void
    {
        $columns = $this->sourceColumns($source);
        $list = array_map(fn ($c) => "`{$c}`", $columns);
        $sql = sprintf(
            'INSERT INTO `%s` (%s) SELECT %s FROM `%s` WHERE `archived_auction_id` = ?',
            $source,
            implode(',', $list),
            implode(',', $list),
            $archive,
        );
        DB::statement($sql, [$auctionId]);
    }

    private function chunkedDeleteArchive(string $archive, int $auctionId): void
    {
        do {
            $deleted = DB::table($archive)
                ->where('archived_auction_id', $auctionId)
                ->limit(self::CHUNK_SIZE)
                ->delete();
        } while ($deleted > 0);
    }

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
