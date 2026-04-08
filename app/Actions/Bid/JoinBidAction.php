<?php

namespace App\Actions\Bid;

use App\DTOs\BidResultDto;
use App\Events\BidderUpdated;
use App\Models\BidEvent;
use App\Models\BidLimitPrice;
use App\Models\BidParticipant;
use App\Models\Item;
use App\Models\Lane;
use App\Services\CountdownService;
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

        DB::beginTransaction();
        try {
            $participant = BidParticipant::participate($item->id, $userId, true, $ipAddress, $userAgent);
            BidEvent::recordJoin($item->id, $userId, $item->current_price, $ipAddress, $userAgent);
            $activeBidderCount = BidParticipant::forItem($item->id)->active()->count();
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        // カウントダウンキャッシュに最後の入札者を記録
        if ($lane) {
            $cacheKey = "countdown:lane:{$lane->id}";
            $state = Cache::get($cacheKey);
            if ($state) {
                $state['last_bidder_user_id'] = $userId;
                Cache::put($cacheKey, $state, 3600);
            }

            try {
                broadcast(new BidderUpdated($auction->id, $lane->id, $item->id, $activeBidderCount, 'joined'))
                    ->toOthers();
            } catch (\Exception $e) {
                Log::warning("JoinBid BidderUpdated broadcast error: " . $e->getMessage());
            }
        }

        // コミット後に最新の入札者数を再取得（トランザクション外なので古い値を使わない）
        $freshBidderCount = BidParticipant::forItem($item->id)->active()->count();

        // 入札者が2人以上になった場合、即座に価格上昇 → フリーズカウントダウン
        // 最後に入札した人（このユーザー）が落札権利者となり、他の入札者は自動離脱
        if ($freshBidderCount >= 2 && $lane) {
            try {
                $lane->load('auction');
                $countdownService = app(CountdownService::class);
                $countdownService->handleImmediatePriceIncrement($lane, $item->fresh(), $auction, $userId);
            } catch (\Exception $e) {
                Log::error("Immediate price increment error on join: " . $e->getMessage());
            }
        }

        $freshItem = $item->fresh();
        $latestBidderCount = $freshBidderCount;

        return BidResultDto::success([
            'participant_id'      => $participant->id,
            'item_id'             => $item->id,
            'is_active'           => true,
            'current_price'       => $freshItem->current_price,
            'active_bidder_count' => $latestBidderCount,
        ], '入札に参加しました。');
    }
}
