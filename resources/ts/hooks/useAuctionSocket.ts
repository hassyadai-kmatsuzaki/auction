import { useEffect, useState, useRef } from 'react';
import { getEcho, isEchoEnabled } from '../lib/echo';
import type { Item } from '../types';

// イベント型定義
export interface PriceUpdatedEvent {
  item_id: number;
  lane_id: number;
  new_price: number;
  active_bidders_count: number;
  countdown_seconds: number;
  auto_left_user_ids?: number[];
}

export interface BidderUpdatedEvent {
  item_id: number;
  lane_id: number;
  active_bidders_count: number;
  event_type: 'joined' | 'left';
}

export interface LaneChangedEvent {
  lane_id: number;
  lane_number: number;
  previous_item_id: number | null;
  current_item: Partial<Item> | null;
}

export interface ItemSoldEvent {
  item_id: number;
  lane_id: number;
  winner_id: number;
  winning_price: number;
  species_name?: string;
  item_number?: number;
  quantity?: number;
}

export interface AuctionStatusEvent {
  auction_id: number;
  status: string;
  message: string;
  countdown_seconds?: number;
}

export interface CountdownTickEvent {
  lane_id: number;
  item_id: number;
  remaining_seconds: number;
  active_bidders_count: number;
  current_price: number;
  phase?: 'bidding' | 'pre_bid' | 'freeze';
}

export interface BidLimitReachedEvent {
  lane_id: number;
  item_id: number;
  user_id: number;
  current_price: number;
  limit_price: number;
  species_name: string;
  limit_cancelled: boolean;
  message: string;
}

// 実装書 B2/B3: 同価格 bid_limit 集約イベント
//   100 名同価格指値時に N 個の BidLimitReached を 1 個に集約
export interface BidLimitsBatchTriggeredEvent {
  lane_id: number;
  item_id: number;
  current_price: number;
  count: number;
  triggered: Array<{
    user_id: number;
    limit_price: number;
    action: 'cancelled' | 'triggered';
    protected: boolean;
  }>;
}

interface UseAuctionSocketOptions {
  auctionId: number;
  onPriceUpdated?: (event: PriceUpdatedEvent) => void;
  onBidderUpdated?: (event: BidderUpdatedEvent) => void;
  onLaneChanged?: (event: LaneChangedEvent) => void;
  onItemSold?: (event: ItemSoldEvent) => void;
  onAuctionStatus?: (event: AuctionStatusEvent) => void;
  onCountdownTick?: (event: CountdownTickEvent) => void;
  onBidLimitReached?: (event: BidLimitReachedEvent) => void;
  onBidLimitsBatchTriggered?: (event: BidLimitsBatchTriggeredEvent) => void;
  onConnectionError?: (error: unknown) => void;
}

interface UseAuctionSocketReturn {
  isConnected: boolean;
  isEnabled: boolean;
}

/**
 * オークションのリアルタイムイベントを購読するカスタムフック
 */
export function useAuctionSocket({
  auctionId,
  onPriceUpdated,
  onBidderUpdated,
  onLaneChanged,
  onItemSold,
  onAuctionStatus,
  onCountdownTick,
  onBidLimitReached,
  onBidLimitsBatchTriggered,
  onConnectionError,
}: UseAuctionSocketOptions): UseAuctionSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof getEcho> extends { channel: (name: string) => infer R } ? R : never | null>(null);

  // コールバックをrefで保持（再購読を防ぐ）
  const callbacksRef = useRef<Required<UseAuctionSocketOptions>>({
    auctionId,
    onPriceUpdated:           onPriceUpdated            ?? (() => {}),
    onBidderUpdated:          onBidderUpdated           ?? (() => {}),
    onLaneChanged:            onLaneChanged             ?? (() => {}),
    onItemSold:               onItemSold                ?? (() => {}),
    onAuctionStatus:          onAuctionStatus           ?? (() => {}),
    onCountdownTick:          onCountdownTick           ?? (() => {}),
    onBidLimitReached:        onBidLimitReached         ?? (() => {}),
    onBidLimitsBatchTriggered: onBidLimitsBatchTriggered ?? (() => {}),
    onConnectionError:        onConnectionError         ?? (() => {}),
  });

  // コールバックを最新に更新
  callbacksRef.current = {
    auctionId,
    onPriceUpdated:           onPriceUpdated            ?? (() => {}),
    onBidderUpdated:          onBidderUpdated           ?? (() => {}),
    onLaneChanged:            onLaneChanged             ?? (() => {}),
    onItemSold:               onItemSold                ?? (() => {}),
    onAuctionStatus:          onAuctionStatus           ?? (() => {}),
    onCountdownTick:          onCountdownTick           ?? (() => {}),
    onBidLimitReached:        onBidLimitReached         ?? (() => {}),
    onBidLimitsBatchTriggered: onBidLimitsBatchTriggered ?? (() => {}),
    onConnectionError:        onConnectionError         ?? (() => {}),
  };

  // WebSocket が有効かどうか
  const isEnabled = isEchoEnabled();

  useEffect(() => {
    // auctionIdが無効、またはEchoが無効の場合は何もしない
    if (!auctionId || !isEnabled) {
      return;
    }

    const echo = getEcho();
    if (!echo) {
      return;
    }

    const channelName = `auction.${auctionId}.live`;
    // 実装書 W3: production では console.log を全停止（ブラウザメモリ圧力対策）
    // 120 名 × 毎秒数件 × 3 時間 = 数十万行の console 蓄積で GC 圧迫が起きる
    const IS_DEV = import.meta.env.DEV;
    if (IS_DEV) console.log('[Socket] Subscribing to channel:', channelName);

    try {
      const channel = echo.channel(channelName);
      channelRef.current = channel;
      setIsConnected(true);
      if (IS_DEV) console.log('[Socket] Channel subscribed successfully');

      // 価格更新イベント
      channel.listen('.price.updated', (event: PriceUpdatedEvent) => {
        if (IS_DEV) console.log('[Socket] price.updated:', event);
        callbacksRef.current.onPriceUpdated?.(event);
      });

      // 入札者更新イベント
      channel.listen('.bidder.updated', (event: BidderUpdatedEvent) => {
        if (IS_DEV) console.log('[Socket] bidder.updated:', event);
        callbacksRef.current.onBidderUpdated?.(event);
      });

      // レーン変更イベント
      channel.listen('.lane.changed', (event: LaneChangedEvent) => {
        if (IS_DEV) console.log('[Socket] lane.changed:', event);
        callbacksRef.current.onLaneChanged?.(event);
      });

      // 落札イベント
      channel.listen('.item.sold', (event: ItemSoldEvent) => {
        if (IS_DEV) console.log('[Socket] item.sold:', event);
        callbacksRef.current.onItemSold?.(event);
      });

      // オークションステータス変更イベント
      channel.listen('.auction.status', (event: AuctionStatusEvent) => {
        if (IS_DEV) console.log('[Socket] auction.status:', event);
        callbacksRef.current.onAuctionStatus?.(event);
      });

      // カウントダウンティックイベント（毎秒のため特に重要）
      channel.listen('.countdown.tick', (event: CountdownTickEvent) => {
        if (IS_DEV) console.log('[Socket] countdown.tick:', event);
        callbacksRef.current.onCountdownTick?.(event);
      });

      // 指値自動オフイベント（個別、後方互換）
      channel.listen('.bid.limit.reached', (event: BidLimitReachedEvent) => {
        callbacksRef.current.onBidLimitReached?.(event);
      });

      // 実装書 B2/B3: 指値同時発動の集約イベント（100名同価格対応）
      //   N 件の bid.limit.reached を 1 件で集約。フロントは triggered 配列を一括処理。
      channel.listen('.bid.limits.batch.triggered', (event: BidLimitsBatchTriggeredEvent) => {
        callbacksRef.current.onBidLimitsBatchTriggered?.(event);
      });
    } catch (error) {
      setIsConnected(false);
      callbacksRef.current.onConnectionError?.(error);
    }

    // クリーンアップ（実装書 F4: ページ遷移時の listener 残留防止）
    return () => {
      const echo = getEcho();
      if (echo && channelRef.current) {
        // 明示的に listener を unbind してから leave（Pusher 側で参照が残るケース対策）
        try {
          const ch: any = channelRef.current;
          if (typeof ch.stopListening === 'function') {
            // 実装書 C1: stopListening のイベント名を listen と一致させる
            //   旧: '.auction.status.changed' は実際の broadcastAs と不一致 → 空振り
            //   旧: '.item.unsold' は listen していない dead code → 削除
            //   修正: サーバーの broadcastAs と完全一致するように
            ch.stopListening('.price.updated');
            ch.stopListening('.bidder.updated');
            ch.stopListening('.lane.changed');
            ch.stopListening('.countdown.tick');
            ch.stopListening('.item.sold');
            ch.stopListening('.auction.status');
            ch.stopListening('.bid.limit.reached');
            ch.stopListening('.bid.limits.batch.triggered');
          }
        } catch (e) {
          console.warn('[Socket] stopListening failed:', e);
        }
        echo.leave(channelName);
      }
      channelRef.current = null;
      setIsConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId, isEnabled]); // コールバックの変更で再購読しない

  return {
    isConnected,
    isEnabled,
  };
}

export default useAuctionSocket;
