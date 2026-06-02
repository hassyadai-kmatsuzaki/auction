<?php

namespace App\Actions\Exhibit;

use App\Jobs\NotifyExhibitCodesJob;
use App\Models\Item;
use App\Models\Lane;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * 出品ID（exhibit_code）を発行するアクション。
 *
 * 表示専用フィールドのため新たな lockForUpdate は取らず、`assignItem` / `autoAssign` の
 * 既存トランザクションに乗せて「lane_items への INSERT 完了 → exhibit_code セット」を1回実行する。
 *
 * 発行ルール:
 *  - `{lane.lane_name}-{sprintf('%03d', lane_items.sequence_order)}` （例: `A-001`）
 *    印刷QRカード（AI動画パイプライン）の exhibit_code と完全一致させる必要があるため、
 *    レーン名と連番の間にハイフンを入れる（仕様: docs/api/internal-item-media-upload.md）。
 *  - 一度セットされた exhibit_code は再採番しない（後続のレーン移動・並び替えで sequence_order が変わっても固定）
 *  - lane_name 未設定や lane 未割当の場合は黙ってスキップ（業務ロジックには関与しない表示用なので例外を投げない）
 */
class IssueExhibitCodeAction
{
    /**
     * 単一アイテムに対して出品IDを発行する。
     *
     * 発行成功時は通知ジョブをキューに乗せる（既発行アイテムや lane 未割当アイテムは何もしない）。
     */
    public function execute(Item $item, bool $silent = false): ?string
    {
        // 固定済み
        if ($item->exhibit_code !== null) {
            return $item->exhibit_code;
        }

        $code = $this->computeCode($item->id);
        if ($code === null) {
            return null;
        }

        $item->update([
            'exhibit_code' => $code,
            'exhibit_code_issued_at' => now(),
        ]);

        if (! $silent) {
            $this->scheduleNotification($item);
        }

        return $code;
    }

    /**
     * 複数アイテムを一括で処理する（autoAssign 用）。
     *
     * @param  iterable<Item>  $items
     */
    public function executeMany(iterable $items, bool $silent = false): int
    {
        $count = 0;
        foreach ($items as $item) {
            if ($this->execute($item, $silent) !== null) {
                $count++;
            }
        }
        return $count;
    }

    private function computeCode(int $itemId): ?string
    {
        $row = DB::table('lane_items')
            ->join('lanes', 'lanes.id', '=', 'lane_items.lane_id')
            ->where('lane_items.item_id', $itemId)
            ->select('lanes.lane_name', 'lane_items.sequence_order')
            ->first();

        if (! $row) {
            return null;
        }

        $laneName = trim((string) ($row->lane_name ?? ''));
        if ($laneName === '') {
            // lane_name 未設定: 業務には影響しないので何もしない
            return null;
        }

        return sprintf('%s-%03d', $laneName, (int) $row->sequence_order);
    }

    private function scheduleNotification(Item $item): void
    {
        $sellerProfileId = $item->seller_profile_id;
        if (! $sellerProfileId) {
            return;
        }

        try {
            NotifyExhibitCodesJob::dispatchIfNotPending($sellerProfileId, $item->auction_id);
        } catch (\Throwable $e) {
            // 通知側のエラーは exhibit_code 発行自体に影響させない（CountdownService と同じ防御）
            Log::warning('NotifyExhibitCodesJob dispatch failed: item=' . $item->id . ' - ' . $e->getMessage());
        }
    }
}
