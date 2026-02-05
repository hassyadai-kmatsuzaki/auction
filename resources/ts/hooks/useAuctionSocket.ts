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
}

export interface AuctionStatusEvent {
  auction_id: number;
  status: string;
  message: string;
}

export interface CountdownTickEvent {
  lane_id: number;
  item_id: number;
  remaining_seconds: number;
  active_bidders_count: number;
  current_price: number;
}

interface UseAuctionSocketOptions {
  auctionId: number;
  onPriceUpdated?: (event: PriceUpdatedEvent) => void;
  onBidderUpdated?: (event: BidderUpdatedEvent) => void;
  onLaneChanged?: (event: LaneChangedEvent) => void;
  onItemSold?: (event: ItemSoldEvent) => void;
  onAuctionStatus?: (event: AuctionStatusEvent) => void;
  onCountdownTick?: (event: CountdownTickEvent) => void;
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
  onConnectionError,
}: UseAuctionSocketOptions): UseAuctionSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof getEcho> extends { channel: (name: string) => infer R } ? R : never | null>(null);

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
    console.log('[Socket] Subscribing to channel:', channelName);

    try {
      const channel = echo.channel(channelName);
      channelRef.current = channel;
      setIsConnected(true);
      console.log('[Socket] Channel subscribed successfully');

      // 価格更新イベント
      channel.listen('.price.updated', (event: PriceUpdatedEvent) => {
        console.log('[Socket] price.updated:', event);
        if (onPriceUpdated) onPriceUpdated(event);
      });

      // 入札者更新イベント
      channel.listen('.bidder.updated', (event: BidderUpdatedEvent) => {
        console.log('[Socket] bidder.updated:', event);
        if (onBidderUpdated) onBidderUpdated(event);
      });

      // レーン変更イベント
      channel.listen('.lane.changed', (event: LaneChangedEvent) => {
        console.log('[Socket] lane.changed:', event);
        if (onLaneChanged) onLaneChanged(event);
      });

      // 落札イベント
      channel.listen('.item.sold', (event: ItemSoldEvent) => {
        console.log('[Socket] item.sold:', event);
        if (onItemSold) onItemSold(event);
      });

      // オークションステータス変更イベント
      channel.listen('.auction.status', (event: AuctionStatusEvent) => {
        console.log('[Socket] auction.status:', event);
        if (onAuctionStatus) onAuctionStatus(event);
      });

      // カウントダウンティックイベント
      channel.listen('.countdown.tick', (event: CountdownTickEvent) => {
        console.log('[Socket] countdown.tick:', event);
        if (onCountdownTick) onCountdownTick(event);
      });
    } catch (error) {
      setIsConnected(false);
      if (onConnectionError) {
        onConnectionError(error);
      }
    }

    // クリーンアップ
    return () => {
      const echo = getEcho();
      if (echo) {
        echo.leave(channelName);
      }
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [auctionId, isEnabled, onPriceUpdated, onBidderUpdated, onLaneChanged, onItemSold, onAuctionStatus, onCountdownTick, onConnectionError]);

  return {
    isConnected,
    isEnabled,
  };
}

export default useAuctionSocket;
