<?php

namespace App\Actions\Bid;

use App\DTOs\BidResultDto;
use App\Events\BidderUpdated;
use App\Logging\BroadcastFailureLogger;
use App\Models\BidEvent;
use App\Models\BidLimitPrice;
use App\Models\BidParticipant;
use App\Models\Item;
use App\Models\Lane;
use App\Services\CountdownService;
// CountdownService::CACHE_TTL を直接参照
use App\Services\Monitoring\MetricRecorder;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * 入札参加アクション
 *
 * 単一責任: 入札ONのユースケースのみを担当
 */
class JoinBidAction
{
    public function execute(
        Item    $item,
        int     $userId,
        ?string $ipAddress = null,
        ?string $userAgent = null,
    ): BidResultDto {
        if ($item->status !== 'live') {
            return BidResultDto::failure('この商品は現在入札を受け付けていません。');
        }

        $auction = $item->auction;
        if ($auction->status !== 'live') {
            return BidResultDto::failure('オークションが開催中ではありません。');
        }

        // 入札開始待機フェーズ・フリーズフェーズ中は入札不可
        $lane = Lane::where('current_item_id', $item->id)->first();
        if ($lane) {
            $countdownState = Cache::get("countdown:lane:{$lane->id}");
            $phase = $countdownState['phase'] ?? 'bidding';
            if ($countdownState && $phase === 'pre_bid') {
                return BidResultDto::failure(
                    '入札開始待機中です。もう少々お待ちください。',
                    ['pre_bid_remaining_seconds' => $countdownState['remaining_seconds'] ?? 0]
                );
            }
            if ($countdownState && $phase === 'freeze') {
                return BidResultDto::failure(
                    '誤タップ防止中です。もう少々お待ちください。',
                    ['freeze_remaining_seconds' => $countdownState['remaining_seconds'] ?? 0]
                );
            }
        }

        // 指値（上限価格）が設定されており、現在価格が既に上限以上なら入札を拒否
        // ※ 指値発動時にレコードは削除されるため、ここに到達するのは
        //    発動前（limit_price > current_price）の指値のみ
        $limit = BidLimitPrice::forItem($item->id)->forUser($userId)->first();
        if ($limit && $item->current_price >= $limit->limit_price) {
            return BidResultDto::failure(
                "上限価格（¥" . number_format($limit->limit_price) . "）に達しているため入札できません。上限価格を変更してください。",
                ['limit_price' => $limit->limit_price]
            );
        }

        // ─── 応用層ロック（Redis）で item 単位に直列化 ───────────
        // 100人同時タップの最悪ケースでは、items 行ロックの DB キューに
        // 全員が並ぶ前に「先行 Join のIncPrice + freeze cache 書き込み」が
        // 完了しないと、後続が一旦 join → 直後 auto-left の連鎖になる。
        // Redis Cache::lock を最前段に置いて、処理中ユーザー以外は最大 0.3 秒待機する。
        // TTL=5s は処理ハング時の保険（通常 100ms 以内に release される）。
        // block(0.3): 通常は数十 ms で release されるので、待てば成功するケースが多い。
        // それでも取れない場合のみエラーを返す（クライアントの不要な再送を抑制）。
        $bidLock = Cache::lock("bid_inflight:item:{$item->id}", 5);
        try {
            $bidLock->block(0.3);
        } catch (LockTimeoutException $e) {
            return BidResultDto::failure('現在他のユーザーの入札を処理中です。少しお待ちください。');
        }

        // ─── ロック順序プロトコル ─────────────────────────────────
        // items(行ロック) → bid_participants → bid_events の順で取得。
        // handlePriceIncrement / adjustPriceByBidLimits も同順なので、
        // 同一item上の入札系トランザクションが直列化されデッドロックしない。
        // また、フリーズ/価格変動を「ロック取得後」に再検証することで、
        // 0.1秒級の競合（freeze cache 反映前 / 直前のIncPrice commit直後）も取りこぼさない。
        try {
            $tx = DB::transaction(function () use ($item, $userId, $ipAddress, $userAgent, $lane) {
                $locked = Item::where('id', $item->id)->lockForUpdate()->first();
                if (!$locked || $locked->status !== 'live') {
                    return ['fail' => '商品がライブ中ではなくなりました。'];
                }

                // ロック取得後に phase 再判定（先行 IncPrice の freeze書き込みを取りこぼさない）
                if ($lane) {
                    $cs = Cache::get("countdown:lane:{$lane->id}");
                    $phase = $cs['phase'] ?? 'bidding';
                    if ($cs && $phase === 'pre_bid') {
                        return ['fail' => '入札開始待機中です。もう少々お待ちください。'];
                    }
                    if ($cs && $phase === 'freeze') {
                        return ['fail' => '誤タップ防止中です。もう少々お待ちください。'];
                    }
                }

                // 価格不一致 → 直前に他者の入札が確定 → 入札中の自分の意思とズレるため拒否
                if ((float) $locked->current_price !== (float) $item->current_price) {
                    return ['fail' => '価格が更新されました。最新の価格をご確認のうえ再度入札してください。'];
                }

                // 上限価格 (bid_limit) を最新価格で再評価
                $limit = BidLimitPrice::forItem($locked->id)->forUser($userId)->first();
                if ($limit && $locked->current_price >= $limit->limit_price) {
                    return ['fail' => "上限価格（¥" . number_format($limit->limit_price) . "）に達しているため入札できません。上限価格を変更してください。"];
                }

                $participant = BidParticipant::participate($locked->id, $userId, true, $ipAddress, $userAgent);
                BidEvent::recordJoin($locked->id, $userId, (float) $locked->current_price, $ipAddress, $userAgent);
                $activeBidderCount = BidParticipant::forItem($locked->id)->active()->count();

                return [
                    'participant'         => $participant,
                    'active_bidder_count' => $activeBidderCount,
                    'current_price'       => (float) $locked->current_price,
                ];
            }, 3);
        } catch (\Exception $e) {
            optional($bidLock)->release();
            app(MetricRecorder::class)->bidFailure($item->id, $userId, 'join_bid_db_error', $e->getMessage());
            throw $e;
        }

        if (isset($tx['fail'])) {
            optional($bidLock)->release();
            return BidResultDto::failure($tx['fail']);
        }

        try {
            $participant       = $tx['participant'];
            $activeBidderCount = $tx['active_bidder_count'];

            // カウントダウンキャッシュに最後の入札者を記録
            if ($lane) {
                $cacheKey = "countdown:lane:{$lane->id}";
                $state = Cache::get($cacheKey);
                if ($state) {
                    $state['last_bidder_user_id'] = $userId;
                    Cache::put($cacheKey, $state, CountdownService::CACHE_TTL);
                }

                try {
                    broadcast(new BidderUpdated($auction->id, $lane->id, $item->id, $activeBidderCount, 'joined'))
                        ->toOthers();
                } catch (\Exception $e) {
                    BroadcastFailureLogger::warn('BidderUpdated', $e->getMessage(), [
                        'item_id' => $item->id, 'lane_id' => $lane->id, 'event_type' => 'joined',
                    ]);
                }
            }

            // 入札者が2人以上になった場合、即座に価格上昇 → フリーズカウントダウン
            // 最後に入札した人（このユーザー）が落札権利者となり、他の入札者は自動離脱
            // ★ 重要: handleImmediatePriceIncrement は bidLock を保持したまま実行する。
            //         ここで release してから IncPrice を走らせると、後続 join が
            //         「join 成功 → 直後に auto-left」の連鎖を起こす。
            if ($activeBidderCount >= 2 && $lane) {
                try {
                    $lane->load('auction');
                    $countdownService = app(CountdownService::class);
                    $countdownService->handleImmediatePriceIncrement($lane, $item->fresh(), $auction, $userId);
                } catch (\Exception $e) {
                    Log::error("Immediate price increment error on join: " . $e->getMessage());
                    app(MetricRecorder::class)->priceIncrementFailed($item->id, 'immediate_on_join', $e->getMessage());
                }
            }

            $freshItem = $item->fresh();
            $latestBidderCount = BidParticipant::forItem($item->id)->active()->count();

            return BidResultDto::success([
                'participant_id'      => $participant->id,
                'item_id'             => $item->id,
                'is_active'           => true,
                'current_price'       => $freshItem->current_price,
                'active_bidder_count' => $latestBidderCount,
            ], '入札に参加しました。');
        } finally {
            optional($bidLock)->release();
        }
    }
}
