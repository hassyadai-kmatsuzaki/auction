<?php

namespace App\Services;

use App\Models\Auction;
use App\Models\BidLimitPrice;
use App\Models\BidParticipant;
use App\Models\Favorite;
use App\Traits\MediaUrlTrait;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * BidService（スリム版）
 *
 * 入札参加・離脱・落札確定・価格上昇はそれぞれ専用 Action に移行済み。
 * このクラスは「読み取り系」のみを担当する。
 */
class BidService
{
    use MediaUrlTrait;

    /**
     * @deprecated CountdownService との循環参照回避のために残存。使用不要。
     */
    public function setCountdownService(mixed $countdownService): void {}

    /** B-4: 参加者向けライブ状態の共有部分を置くキャッシュキー */
    public static function sharedStateKey(int $auctionId): string
    {
        return "live_state:shared:{$auctionId}";
    }

    /**
     * B-4: 共有部分のキャッシュを捨てる。レーンの現在商品や状態が変わったときに呼ぶ
     * （Lane モデルの saved フック、レーンの一括更新、オークション終了）。
     */
    public static function forgetSharedState(int $auctionId): void
    {
        Cache::forget(self::sharedStateKey($auctionId));
    }

    /**
     * ライブオークション状態を取得（参加者向け）
     *
     * B-4 (2026-09-14): 商品切替のたびに参加者全員が同時に取りに来る（9/20 は 500 名、切替 18 秒ごと）。
     *   応答を「共有部分」と「毎回取る部分」に分け、共有部分はオークション単位で config('live.shared_state_ttl') 秒
     *   キャッシュする（sharedState / buildSharedState）。
     *   - 共有部分: レーン構成、現在商品の静的な項目（名前・出品者・画像 URL など）、次の商品、設定値
     *   - 毎回取る: レーン状態と現在商品 ID（キャッシュの整合確認にも使う）、現在価格、入札者数、
     *              カウントダウン（Redis）、自分の入札・指値・お気に入り
     *   キャッシュの現在商品 ID が DB と食い違っていたら、その要求内で作り直す（切替直後に古い商品を返さない）。
     *   DB 問い合わせは 1 要求あたり約 15 本 → 6 本（ログインなしは 2 本）。
     */
    public function getLiveState(Auction $auction, ?int $userId = null): array
    {
        // 毎回取る（1 本）: レーン状態・現在商品 ID・現在価格・商品状態
        $freshLanes = $this->freshLaneRows($auction->id);

        $shared = $this->sharedState($auction);
        if (!$this->sharedStateMatches($shared, $freshLanes)) {
            // 切替直後や一括更新でキャッシュが追いついていない → この要求で作り直す
            $shared = $this->buildSharedState($auction);
            $this->putSharedState($auction->id, $shared);
            $freshLanes = $this->freshLaneRows($auction->id);
        }

        $defaultCountdown = $shared['countdown_seconds'];
        $currentItemIds   = $shared['current_item_ids'];
        $upcomingItemIds  = $shared['upcoming_item_ids'];

        // 入札者数を一括取得（GROUP BY item_id）
        $bidderCounts = !empty($currentItemIds)
            ? BidParticipant::whereIn('item_id', $currentItemIds)
                ->where('is_active', true)
                ->selectRaw('item_id, COUNT(*) as cnt')
                ->groupBy('item_id')
                ->pluck('cnt', 'item_id')
                ->toArray()
            : [];

        // 自分の入札状態を一括取得
        $myParticipants = ($userId && !empty($currentItemIds))
            ? BidParticipant::whereIn('item_id', $currentItemIds)
                ->where('user_id', $userId)
                ->get()
                ->keyBy('item_id')
            : collect();

        // 自分の指値を一括取得
        $myLimits = ($userId && !empty($currentItemIds))
            ? BidLimitPrice::whereIn('item_id', $currentItemIds)
                ->where('user_id', $userId)
                ->get()
                ->keyBy('item_id')
            : collect();

        $myUpcomingLimits = ($userId && !empty($upcomingItemIds))
            ? BidLimitPrice::whereIn('item_id', $upcomingItemIds)
                ->where('user_id', $userId)
                ->get()
                ->keyBy('item_id')
            : collect();

        $myUpcomingFavorites = ($userId && !empty($upcomingItemIds))
            ? Favorite::where('user_id', $userId)
                ->whereIn('item_id', $upcomingItemIds)
                ->pluck('item_id')
                ->flip()
            : collect();

        // カウントダウンはレーン分をまとめて 1 往復で取る
        $countdownKeys   = array_map(fn ($l) => "countdown:lane:{$l['lane_id']}", $shared['lanes']);
        $countdownStates = !empty($countdownKeys) ? Cache::many($countdownKeys) : [];

        $lanesData = [];
        foreach ($shared['lanes'] as $sharedLane) {
            $laneId = $sharedLane['lane_id'];
            $fresh  = $freshLanes->get($laneId);

            $laneData = [
                'lane_id'      => $laneId,
                'lane_number'  => $sharedLane['lane_number'],
                'lane_name'    => $sharedLane['lane_name'],
                'status'       => $fresh->lane_status ?? $sharedLane['status'],
                'current_item' => null,
            ];

            if ($sharedLane['current_item']) {
                $static            = $sharedLane['current_item'];
                $itemId            = $static['id'];
                $activeBidderCount = $bidderCounts[$itemId] ?? 0;

                $myBidStatus = null;
                $myLimitPrice = null;
                $myLimitTriggered = false;
                if ($userId) {
                    $participant = $myParticipants->get($itemId);
                    $myBidStatus = $participant ? ($participant->is_active ? 'active' : 'inactive') : null;

                    $limit = $myLimits->get($itemId);
                    if ($limit) {
                        $myLimitPrice     = $limit->limit_price;
                        $myLimitTriggered = $limit->is_triggered;
                    }
                }

                $countdownState = $countdownStates["countdown:lane:{$laneId}"] ?? null;

                // Cache miss 復旧（負荷レビュー C4 指摘）:
                // Redis LRU eviction や瞬間的な network timeout でレーン単位に
                // null が返ると、ユーザーごとに「3秒のまま」表示される事故になる。
                // active レーン × 商品ライブ中 で cache が無い場合は、
                // CountdownService::recoverCountdownIfMissing を呼んで再構築 → 再取得する。
                // 復旧自体が失敗しても、最後の保険として $defaultCountdown が走るが、
                // その前に必ず1度復旧を試みる。
                // DEV-2026-011: 復旧は recoverCountdownIfMissing() 経由に限定する。
                //   startCountdown() は無条件 put のため、落札→次商品の遷移中にこのリクエストが
                //   持つ古い lane（売却済み商品）で Pre-bid キャッシュを上書きし、レーンが停止した
                //   （2026-08-14 第7回 lane 113）。recover 版は refresh + live 限定 + Cache::add。
                // B-4: レーンモデルは復旧が必要なときだけ読む（9/11 は 65 分で 27 回）。
                $laneStatus = $fresh->lane_status ?? null;
                $itemStatus = $fresh->item_status ?? null;
                if (!$countdownState && $laneStatus === 'active' && $itemStatus === 'live') {
                    try {
                        $laneModel      = \App\Models\Lane::with('currentItem')->find($laneId);
                        $recovered      = $laneModel
                            ? app(\App\Services\CountdownService::class)->recoverCountdownIfMissing($laneModel)
                            : false;
                        $countdownState = Cache::get("countdown:lane:{$laneId}");
                        Log::warning('getLiveState: countdown cache miss recovered', [
                            'lane_id'    => $laneId,
                            'item_id'    => $countdownState['item_id'] ?? null, // 実際にキャッシュにある商品
                            'recovered'  => $recovered,                         // false = 誰かが先に書いていた（上書きを防いだ）
                            'auction_id' => $auction->id,
                        ]);
                    } catch (\Throwable $e) {
                        Log::error('getLiveState: countdown cache recovery failed', [
                            'lane_id' => $laneId,
                            'error'   => $e->getMessage(),
                        ]);
                    }
                }

                $remainingSeconds = $countdownState['remaining_seconds'] ?? $defaultCountdown;
                $phase            = $countdownState['phase'] ?? 'bidding';
                $preBidRemaining  = $phase === 'pre_bid' ? ($countdownState['remaining_seconds'] ?? 0) : 0;
                $freezeTotal      = (float) ($countdownState['freeze_countdown_seconds'] ?? 1);
                $countdownMode    = $countdownState['countdown_mode'] ?? 'default';

                $laneData['current_item'] = $static + [
                    'current_price'            => $fresh->current_price ?? $static['current_price_at_build'],
                    'active_bidders_count'     => $activeBidderCount,
                    'countdown_seconds'        => $remainingSeconds,
                    'my_bid_status'            => $myBidStatus,
                    'phase'                    => $phase,
                    'pre_bid_remaining_seconds'=> $preBidRemaining,
                    'countdown_mode'           => $countdownMode, // @deprecated フロントエンドで未使用。互換のため残存。
                    'countdown_seconds_competitive' => $countdownState['countdown_seconds_competitive'] ?? 1, // @deprecated フロントエンドで未使用。互換のため残存。
                    'freeze_countdown_seconds' => $freezeTotal,
                    'my_limit_price'           => $myLimitPrice,
                    'my_limit_triggered'       => $myLimitTriggered,
                ];
                unset($laneData['current_item']['current_price_at_build']);
            }

            // upcoming items: 共有部分の静的項目に自分の指値・お気に入りを重ねる
            $upcomingItems = [];
            foreach ($sharedLane['upcoming_items'] as $data) {
                if ($userId) {
                    $limit = $myUpcomingLimits->get($data['id']);
                    $data['is_favorited']       = $myUpcomingFavorites->has($data['id']);
                    $data['my_limit_price']     = $limit?->limit_price;
                    $data['my_limit_triggered'] = $limit?->is_triggered ?? false;
                }
                $upcomingItems[] = $data;
            }
            $laneData['upcoming_items'] = $upcomingItems;

            $lanesData[] = $laneData;
        }

        return [
            'auction_id'    => $auction->id,
            'auction_title' => $auction->title,
            'status'        => $auction->status,
            'countdown_seconds' => $defaultCountdown,
            'price_increment_tiers' => $shared['price_increment_tiers'],
            'countdown_tiers'       => $shared['countdown_tiers'],
            'lanes'         => $lanesData,
        ];
    }

    /**
     * B-4: レーンごとの「今の」状態を 1 本で取る（レーン状態・現在商品 ID・現在価格・商品状態）。
     */
    private function freshLaneRows(int $auctionId): \Illuminate\Support\Collection
    {
        return \DB::table('lanes')
            ->leftJoin('items', 'items.id', '=', 'lanes.current_item_id')
            ->where('lanes.auction_id', $auctionId)
            ->orderBy('lanes.lane_number')
            ->get([
                'lanes.id as lane_id',
                'lanes.status as lane_status',
                'lanes.current_item_id',
                'items.current_price',
                'items.status as item_status',
            ])
            ->keyBy('lane_id');
    }

    /**
     * B-4: キャッシュの共有部分が DB の「レーン一覧と現在商品 ID」と一致しているか。
     */
    private function sharedStateMatches(array $shared, \Illuminate\Support\Collection $freshLanes): bool
    {
        if (count($shared['lanes']) !== $freshLanes->count()) {
            return false;
        }
        foreach ($shared['lanes'] as $lane) {
            $fresh = $freshLanes->get($lane['lane_id']);
            if (!$fresh || (int) ($fresh->current_item_id ?? 0) !== (int) ($lane['current_item_id'] ?? 0)) {
                return false;
            }
        }
        return true;
    }

    /**
     * B-4: 共有部分をキャッシュから取る。無ければ 1 プロセスだけが組み立て、他は短く待って結果を使う
     * （切替直後の同時要求で DB を何度も読まない）。TTL 0 なら毎回組み立てる。
     */
    private function sharedState(Auction $auction): array
    {
        $ttl = (int) config('live.shared_state_ttl', 1);
        if ($ttl <= 0) {
            return $this->buildSharedState($auction);
        }

        $key = self::sharedStateKey($auction->id);
        $cached = Cache::get($key);
        if (is_array($cached)) {
            return $cached;
        }

        $lock = Cache::lock($key . ':lock', 5);
        if ($lock->get()) {
            try {
                $state = $this->buildSharedState($auction);
                Cache::put($key, $state, $ttl);
                return $state;
            } finally {
                $lock->release();
            }
        }

        // 他の要求が組み立て中。最長 400ms 待ってキャッシュを読む。間に合わなければ自分で組み立てる
        for ($i = 0; $i < 4; $i++) {
            usleep(100_000);
            $cached = Cache::get($key);
            if (is_array($cached)) {
                return $cached;
            }
        }
        return $this->buildSharedState($auction);
    }

    private function putSharedState(int $auctionId, array $state): void
    {
        $ttl = (int) config('live.shared_state_ttl', 1);
        if ($ttl > 0) {
            Cache::put(self::sharedStateKey($auctionId), $state, $ttl);
        }
    }

    /**
     * B-4: 共有部分を DB から組み立てる（旧 getLiveState の重い部分をそのまま移した）。
     * 毎回変わる値（現在価格・入札者数・カウントダウン・自分の状態）は含めない。
     */
    private function buildSharedState(Auction $auction): array
    {
        // 実装書 N1: lane.items の eager load を削除（過剰ロード対策）
        //   修正前: 'items' を with() で全件ロード → 1 lane に 100 件あれば 300 件 SELECT
        //   修正後: current_item と upcoming のみ別クエリで最小取得
        $lanes            = $auction->lanes()
            ->with(['currentItem.media', 'currentItem.sellerProfile', 'currentItem.sellerProfile.user:id,trade_name,profile_image_path'])
            ->orderBy('lane_number')
            ->get();
        $defaultCountdown = $auction->getAuctionSettings()['countdown_seconds'] ?? 3;

        // ★ N+1解消: 全アクティブアイテムのデータを一括取得
        $currentItemIds = $lanes->pluck('currentItem.id')->filter()->values()->toArray();

        // 実装書 N1: 各レーンの current_item の sequence_order を一括取得
        $currentSeqByLane = !empty($currentItemIds)
            ? \DB::table('lane_items')
                ->whereIn('lane_id', $lanes->pluck('id'))
                ->whereIn('item_id', $currentItemIds)
                ->select('lane_id', 'sequence_order')
                ->get()
                ->keyBy('lane_id')
            : collect();

        // 実装書 N1: 各レーンの upcoming items（current より後の sequence_order の上位 3 件）を
        //   per-lane に最小取得。3 レーンなら計 3 クエリだが、各 9 行以下で軽量。
        $upcomingByLane = [];
        foreach ($lanes as $lane) {
            $currentSeqRow = $currentSeqByLane->get($lane->id);
            if (!$currentSeqRow) {
                $upcomingByLane[$lane->id] = collect();
                continue;
            }
            $currentSeq = (int) $currentSeqRow->sequence_order;

            $upcomingByLane[$lane->id] = \DB::table('lane_items')
                ->join('items', 'items.id', '=', 'lane_items.item_id')
                ->where('lane_items.lane_id', $lane->id)
                ->where('lane_items.sequence_order', '>', $currentSeq)
                ->where('items.status', 'registered')
                ->orderBy('lane_items.sequence_order', 'asc')
                ->limit(3)
                ->select(
                    'items.id', 'items.item_number', 'items.exhibit_code', 'items.species_name', 'items.quantity',
                    'items.start_price', 'items.thumbnail_path', 'items.is_premium',
                    'items.is_anonymous',
                    'lane_items.sequence_order'
                )
                ->get();
        }

        $upcomingItemIds = [];
        $lanesData = [];
        foreach ($lanes as $lane) {
            $laneData = [
                'lane_id'         => $lane->id,
                'lane_number'     => $lane->lane_number,
                'lane_name'       => $lane->lane_name,
                'status'          => $lane->status,
                'current_item_id' => $lane->current_item_id,
                'current_item'    => null,
            ];

            if ($lane->currentItem) {
                $item          = $lane->currentItem;
                $isAnonCurrent = (bool) $item->is_anonymous;
                $laneData['current_item'] = [
                    'id'                       => $item->id,
                    'item_number'              => $item->item_number,
                    'exhibit_code'             => $item->exhibit_code,
                    'species_name'             => $item->species_name,
                    // 屋号（users.trade_name）を直参照。未設定は null（フロントで「-」表示）。
                    'seller_name'              => $isAnonCurrent ? '匿名出品' : ($item->sellerProfile?->user?->trade_name ?? null),
                    'seller_profile_image_url' => $isAnonCurrent ? null : $item->sellerProfile?->profile_image_url,
                    'quantity'                 => $item->quantity,
                    'quantity_unit'            => $item->quantity_unit ?? 'fish',
                    'current_price_at_build'   => $item->current_price, // 毎回取る値が欠けたときの保険
                    'estimated_price'          => $item->estimated_price, // @deprecated フロントエンドで未使用。互換のため残存。
                    'inspection_info'          => $item->inspection_info,
                    'individual_info'          => $item->individual_info,
                    'is_premium'               => $item->is_premium,
                    'is_anonymous'             => $isAnonCurrent,
                    'thumbnail_path'           => $item->thumbnail_path,
                    'media'                    => $this->transformMedia($item->media),
                ];
            }

            $upcomingItems = [];
            foreach ($upcomingByLane[$lane->id] ?? collect() as $i) {
                $upcomingItemIds[] = (int) $i->id;
                $upcomingItems[] = [
                    'id'             => (int) $i->id,
                    'item_number'    => $i->item_number,
                    'exhibit_code'   => $i->exhibit_code,
                    'species_name'   => $i->species_name,
                    'quantity'       => $i->quantity,
                    'start_price'    => $i->start_price,
                    'thumbnail_path' => $i->thumbnail_path,
                    'is_premium'     => (bool) $i->is_premium,
                    'is_anonymous'   => (bool) $i->is_anonymous,
                ];
            }
            $laneData['upcoming_items'] = $upcomingItems;

            $lanesData[] = $laneData;
        }

        return [
            'built_at'              => microtime(true),
            'countdown_seconds'     => $defaultCountdown,
            'price_increment_tiers' => $auction->getPriceIncrementTiers(),
            'countdown_tiers'       => $auction->getCountdownTiers(),
            'current_item_ids'      => $currentItemIds,
            'upcoming_item_ids'     => $upcomingItemIds,
            'lanes'                 => $lanesData,
        ];
    }

    /**
     * ユーザーのアクティブな入札一覧を取得
     */
    public function getActiveParticipations(int $userId): array
    {
        $participants = BidParticipant::forUser($userId)
            ->active()
            ->with(['item.auction'])
            ->get();

        $result = [];
        foreach ($participants as $participant) {
            $item = $participant->item;
            if ($item && $item->status === 'live') {
                $result[] = [
                    'participant_id' => $participant->id,
                    'item'    => [
                        'id'          => $item->id,
                        'item_number' => $item->item_number,
                        'species_name'=> $item->species_name,
                        'current_price'=> $item->current_price,
                        'quantity'    => $item->quantity,
                    ],
                    'auction' => [
                        'id'    => $item->auction->id,
                        'title' => $item->auction->title,
                    ],
                    'activated_at' => $participant->activated_at,
                ];
            }
        }

        return $result;
    }
}
