<?php

namespace App\Services;

use App\Models\BidLimitPrice;
use Illuminate\Support\Facades\Log;

/**
 * 事前指値の「上位2件だけ計算対象」の並べ直し（2026-11-12）
 *
 * 商品ごとに、未発動の指値を「limit_price 降順 → created_at 昇順 → id 昇順」
 * （adjustPriceByBidLimits と同じ順）で並べ、上位 TOP_RANK_COUNT 件を is_top_rank=1、
 * それ以降を is_top_rank=0（表示専用のダミー）にする。
 *
 * 根拠: 開始時の処理は最高額（落札権利者）と2番目（着地価格）しか使わないので、
 * 3件目以降を行として持たなくても落札者・価格は変わらない。
 * ロック内で処理する人数が N から最大 2+1 に減る。
 *
 * 呼び出し側の約束:
 *   - items の行ロック（lockForUpdate）を持った同じトランザクション内で呼ぶ
 *   - 例外はここで握りつぶす（失敗しても行は既定の is_top_rank=1 のまま＝現行どおり計算対象。
 *     指値処理の例外でカウントダウンを止めない）
 */
class BidLimitRebalancer
{
    /** 計算対象として残す件数（最高額＋2番目） */
    public const TOP_RANK_COUNT = 2;

    /**
     * 並べ直す。商品が未開始（registered）のときだけ。$force=true なら状態に関係なく並べ直す（開始時の保険用）
     *
     * @return int 更新した行数
     */
    public function rebalance(int $itemId, string $itemStatus, bool $force = false): int
    {
        if (!$force && $itemStatus !== 'registered') {
            return 0;
        }

        try {
            $rows = BidLimitPrice::where('item_id', $itemId)
                ->where('is_triggered', false)
                ->orderBy('limit_price', 'desc')
                ->orderBy('created_at', 'asc')
                ->orderBy('id', 'asc')
                ->get(['id', 'is_top_rank']);

            $toTop = [];
            $toDummy = [];
            foreach ($rows as $i => $row) {
                $wantTop = $i < self::TOP_RANK_COUNT;
                if ($wantTop && !$row->is_top_rank) {
                    $toTop[] = $row->id;
                } elseif (!$wantTop && $row->is_top_rank) {
                    $toDummy[] = $row->id;
                }
            }

            if ($toTop) {
                BidLimitPrice::whereIn('id', $toTop)->update(['is_top_rank' => true]);
            }
            if ($toDummy) {
                BidLimitPrice::whereIn('id', $toDummy)->update(['is_top_rank' => false]);
            }

            $changed = count($toTop) + count($toDummy);
            if ($changed > 0) {
                Log::info("BidLimitRebalancer: item={$itemId}, rows={$rows->count()}, promoted=" . count($toTop) . ', demoted=' . count($toDummy));
            }
            return $changed;
        } catch (\Throwable $e) {
            // フェイルオープン: 何もしなければ既定の is_top_rank=1 が残り、現行と同じ処理になる
            Log::error("BidLimitRebalancer failed (fail-open): item={$itemId} - " . $e->getMessage());
            return 0;
        }
    }

    /**
     * 保険: 計算対象が 0 件なのに未発動の指値がある（並べ直しの不整合）なら、全行を計算対象に戻す。
     * 開始時に呼ぶ。これで「指値があるのに誰も参加せず流れる」は起きない
     *
     * @return int 戻した行数
     */
    public function restoreAllIfNoneTopRank(int $itemId): int
    {
        try {
            $base = BidLimitPrice::where('item_id', $itemId)->where('is_triggered', false);
            if ((clone $base)->where('is_top_rank', true)->exists()) {
                return 0;
            }
            $restored = (clone $base)->where('is_top_rank', false)->update(['is_top_rank' => true]);
            if ($restored > 0) {
                Log::warning("BidLimitRebalancer: no top-rank rows for item={$itemId}, restored all {$restored} rows (fail-open)");
            }
            return $restored;
        } catch (\Throwable $e) {
            Log::error("BidLimitRebalancer restore failed: item={$itemId} - " . $e->getMessage());
            return 0;
        }
    }
}
