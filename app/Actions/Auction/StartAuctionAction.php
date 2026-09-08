<?php

namespace App\Actions\Auction;

use App\Events\AuctionStatusChanged;
use App\Jobs\ProcessAuctionCountdownJob;
use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * オークション開始アクション
 *
 * LiveController から複雑なビジネスロジックを切り出した版
 */
class StartAuctionAction
{
    /**
     * Monitor と同じ鮮度基準。これより新しい heartbeat があれば進行ジョブは生きている。
     */
    private const HEARTBEAT_FRESH_SECONDS = 30;

    /**
     * 自動開始（scheduler）用の入口。後方互換のため署名は変えない。
     */
    public function execute(Auction $auction): void
    {
        $this->start($auction, ['scheduled'], false);
    }

    /**
     * A-7 (2026-09-08): 開始経路を1本にまとめた本体。
     *
     *   - 自動開始（auctions:start-scheduled）      → execute() 経由。scheduled のみ。
     *   - 管理画面「開始」ボタン（LiveController）   → start($a, ['preparing','scheduled'], manual: true)
     *   - 管理画面ステータス変更（UpdateAuctionStatusAction）→ 同上
     *
     *   旧実装は3経路が別々に実装されており、いずれも行ロック無しで status を見ていたため、
     *   自動と手動が同じ秒に走ると両方が通過し、2本目の startNextItem が「次の registered」を
     *   live にしてレーンの current_item を上書き → 1商品目が live のまま孤立していた。
     *   ここでは行ロック取得後に status を再確認するので、2本目は必ずここで弾かれる。
     *
     * @param  string[] $allowedStatuses 開始を許可する現在ステータス
     * @param  bool     $manual          管理者操作か。true のとき「進行ジョブが死んでいる」場合に限り
     *                                   start_at を上書きして再 dispatch する（押し直しによる復旧を温存）
     * @throws \RuntimeException 開始できない状態のとき（呼び出し側がメッセージをそのまま表示できる）
     */
    public function start(Auction $auction, array $allowedStatuses = ['scheduled'], bool $manual = false): void
    {
        $preStartCountdown = $auction->getStartCountdownSeconds();

        // 事前チェック（ロック前）。ここは早期にわかりやすいメッセージを返すためだけで、
        // 真の判定はトランザクション内の行ロック後に行う。
        if (!in_array($auction->status, $allowedStatuses, true)) {
            throw new \RuntimeException('このオークションは開始できません。（ステータス: ' . $auction->status . '）');
        }

        DB::beginTransaction();
        try {
            // A-7: 行ロックを取ってから status を再確認する。
            //   同じ秒に別経路が走っていても、先にコミットした側が status を live にしているので
            //   後から来た側はここで弾かれる（DB ロックで直列化される）。
            $locked = Auction::whereKey($auction->id)->lockForUpdate()->first();
            if (!$locked || !in_array($locked->status, $allowedStatuses, true)) {
                DB::rollBack();
                throw new \RuntimeException(
                    'このオークションは開始できません。（ステータス: ' . ($locked?->status ?? '不明') . '。別の経路で開始済みの可能性があります）'
                );
            }
            $auction = $locked;

            if ($auction->items()->where('status', 'registered')->count() === 0) {
                DB::rollBack();
                throw new \RuntimeException('オークションを開始できません。承認済みの生体を1件以上登録してください。');
            }

            $this->ensureLanes($auction);
            $this->assignItems($auction);
            $auction->update(['status' => 'live']);

            $lanesToStart = [];
            foreach ($auction->lanes()->orderBy('lane_number')->get() as $lane) {
                if ($this->startNextItem($lane, false)) {
                    $lanesToStart[] = $lane->id;
                }
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        // 古いロック・フラグが残っている場合はクリア（前回のオークションの残骸対策）
        // ※ start_at は Cache::add の二重dispatchガードとして使うので forget しない
        Cache::forget("countdown_job_lock:auction:{$auction->id}");
        Cache::forget("countdown_job_running:auction:{$auction->id}");
        Cache::forget("countdown_job_heartbeat:auction:{$auction->id}");
        Cache::forget("countdown_job_finished:auction:{$auction->id}");

        // 世代番号を0にリセット（新規開始なので古い世代の残骸をクリア）
        Cache::put(ProcessAuctionCountdownJob::generationKey($auction->id), 0, ProcessAuctionCountdownJob::HEARTBEAT_TTL);

        // 二重dispatch ガード: start_at を Cache::add で確保。
        // 既に存在 = 別経路で開始処理が in-flight → 上書きしない（フロントが「10→5→10」に戻る事故防止）
        // TTL はカウントダウンより必ず長く。短いとカウントダウン中にキーが消え、
        // 二重dispatchガードが外れる／APIポーリングが starting を返さなくなる。
        $cacheTtl = max(120, $preStartCountdown + 60);

        $startAtKey = "auction:{$auction->id}:start_at";
        $added = Cache::add($startAtKey, now()->addSeconds($preStartCountdown)->timestamp, $cacheTtl);

        if (!$added) {
            // start_at が残っている = 別経路の開始処理が進行中、または前回の開始が途中で死んだ残骸。
            //   自動開始: 常に見送る（従来どおり）。
            //   管理者の手動開始: 進行ジョブの heartbeat が新鮮なら見送り、死んでいれば上書きして再 dispatch。
            //     旧 LiveController は Cache::put（無条件上書き）で「押し直しで復旧できる」ことを
            //     意図していた。その復旧手段を、生きているジョブを潰さない形で温存する。
            $hb    = (int) Cache::get("countdown_job_heartbeat:auction:{$auction->id}", 0);
            $alive = $hb > 0 && (now()->timestamp - $hb) < self::HEARTBEAT_FRESH_SECONDS;

            if (!$manual || $alive) {
                Log::info('StartAuctionAction: pre-start already in flight, skipping duplicate broadcast/dispatch', [
                    'auction_id' => $auction->id, 'manual' => $manual, 'job_alive' => $alive,
                ]);
                return;
            }

            Log::warning('StartAuctionAction: stale start_at without live job, manual restart overrides it', [
                'auction_id' => $auction->id, 'heartbeat_age' => $hb > 0 ? now()->timestamp - $hb : null,
            ]);
            Cache::put($startAtKey, now()->addSeconds($preStartCountdown)->timestamp, $cacheTtl);
        }

        Cache::put("auction:{$auction->id}:lanes_to_start", $lanesToStart, $cacheTtl);
        broadcast(new AuctionStatusChanged($auction->id, 'starting', 'オークションが間もなく開始されます', $preStartCountdown));

        ProcessAuctionCountdownJob::dispatch($auction->id);
        Log::info("Dispatched auction countdown job for auction {$auction->id}");
    }

    private function ensureLanes(Auction $auction): void
    {
        $laneCount = $auction->lane_count ?: 1;

        $existing = $auction->lanes()->count();
        for ($i = $existing + 1; $i <= $laneCount; $i++) {
            Lane::create(['auction_id' => $auction->id, 'lane_number' => $i, 'status' => 'waiting']);
        }
    }

    private function assignItems(Auction $auction): void
    {
        // 既存の割り当て済みアイテムはスキップ
        $unassigned = Item::where('auction_id', $auction->id)
            ->where('status', 'registered')
            ->whereNotIn('id', function ($q) use ($auction) {
                $q->select('item_id')->from('lane_items')
                  ->join('lanes', 'lane_items.lane_id', '=', 'lanes.id')
                  ->where('lanes.auction_id', $auction->id);
            })
            // A-7: 管理画面の2経路が「プレミアム生体を優先的に上位に配置」していたのに
            //   自動開始だけ item_number 順だった。経路を1本化するにあたり管理画面側の意図に揃える。
            //   実運用ではレーン投入 SQL で unassigned=0 にしてから開催するため、ここは残り物の順序にしか効かない。
            ->orderByDesc('is_premium')
            ->orderBy('item_number')
            ->get();

        $lanes = $auction->lanes()->orderBy('lane_number')->get();
        if ($lanes->isEmpty() || $unassigned->isEmpty()) return;

        $laneCount = $lanes->count();
        foreach ($unassigned as $index => $item) {
            $lane = $lanes[$index % $laneCount];
            $maxOrder = \DB::table('lane_items')->where('lane_id', $lane->id)->max('sequence_order') ?? 0;
            \DB::table('lane_items')->insert([
                'lane_id'        => $lane->id,
                'item_id'        => $item->id,
                'sequence_order' => $maxOrder + 1,
                'created_at'     => now(),
                'updated_at'     => now(),
            ]);
        }
    }

    private function startNextItem(Lane $lane, bool $startCountdown = true): ?Item
    {
        $nextItem = $lane->items()->where('status', 'registered')->orderBy('lane_items.sequence_order')->first();
        if (!$nextItem) return null;

        $nextItem->update(['status' => 'live', 'current_price' => $nextItem->start_price]);
        $lane->update(['current_item_id' => $nextItem->id, 'status' => 'active']);

        return $nextItem;
    }
}
