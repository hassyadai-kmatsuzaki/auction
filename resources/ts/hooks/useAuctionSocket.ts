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

interface UseAuctionSocketOptions {
  auctionId: number;
  onPriceUpdated?: (event: PriceUpdatedEvent) => void;
  onBidderUpdated?: (event: BidderUpdatedEvent) => void;
  onLaneChanged?: (event: LaneChangedEvent) => void;
  onItemSold?: (event: ItemSoldEvent) => void;
  onAuctionStatus?: (event: AuctionStatusEvent) => void;
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

    try {
      const channel = echo.channel(channelName);
      channelRef.current = channel;
      setIsConnected(true);

      // 価格更新イベント
      if (onPriceUpdated) {
        channel.listen('.price.updated', (event: PriceUpdatedEvent) => {
          onPriceUpdated(event);
        });
      }

      // 入札者更新イベント
      if (onBidderUpdated) {
        channel.listen('.bidder.updated', (event: BidderUpdatedEvent) => {
          onBidderUpdated(event);
        });
      }

      // レーン変更イベント
      if (onLaneChanged) {
        channel.listen('.lane.changed', (event: LaneChangedEvent) => {
          onLaneChanged(event);
        });
      }

      // 落札イベント
      if (onItemSold) {
        channel.listen('.item.sold', (event: ItemSoldEvent) => {
          onItemSold(event);
        });
      }

      // オークションステータス変更イベント
      if (onAuctionStatus) {
        channel.listen('.auction.status', (event: AuctionStatusEvent) => {
          onAuctionStatus(event);
        });
      }
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
  }, [auctionId, isEnabled, onPriceUpdated, onBidderUpdated, onLaneChanged, onItemSold, onAuctionStatus, onConnectionError]);

  return {
    isConnected,
    isEnabled,
  };
}

export default useAuctionSocket;
