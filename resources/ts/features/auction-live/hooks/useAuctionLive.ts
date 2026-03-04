import { useQuery, useQueryClient } from '@tanstack/react-query';
import { participantAuctionApi } from '@/api/participant/auctionApi';
import { useAuctionLiveStore } from '@/stores/auctionLiveStore';
import type { CountdownTickEvent, LaneChangedEvent, PriceUpdatedEvent, BidderUpdatedEvent } from '@/hooks/useAuctionSocket';
import type { LiveState, LaneItem } from '@/types';

export const LIVE_STATE_QUERY_KEY = (auctionId: number) =>
  ['auction-live', auctionId] as const;

export function useAuctionLive(auctionId: number) {
  const queryClient = useQueryClient();
  const socketConnected = useAuctionLiveStore((s) => s.socketConnected);

  const query = useQuery({
    queryKey: LIVE_STATE_QUERY_KEY(auctionId),
    queryFn: () => participantAuctionApi.getLiveState(auctionId),
    // scheduled（待機室）は常に5秒ポーリングして入室可否の変化を検知する
    // live中はWebSocket優先、切断中は3秒フォールバック
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'scheduled') return 5000;
      return socketConnected ? false : 3000;
    },
    refetchOnWindowFocus: true,
    staleTime: 500,
    retry: 3,
  });

  /** WebSocket受信時にキャッシュを直接更新（再フェッチなし） */
  const applyCountdownTick = (event: CountdownTickEvent) => {
    queryClient.setQueryData<LiveState>(LIVE_STATE_QUERY_KEY(auctionId), (prev) => {
      if (!prev) return prev;
      const phase = event.phase ?? 'bidding';
      return {
        ...prev,
        lanes: prev.lanes.map((lane) =>
          lane.lane_id === event.lane_id && lane.current_item
            ? {
                ...lane,
                current_item: {
                  ...lane.current_item,
                  countdown_seconds:
                    phase === 'bidding'
                      ? event.remaining_seconds
                      : lane.current_item.countdown_seconds,
                  active_bidders_count: event.active_bidders_count,
                  current_price: event.current_price,
                  phase,
                  pre_bid_remaining_seconds:
                    phase === 'pre_bid' ? event.remaining_seconds : 0,
                  freeze_remaining_seconds:
                    phase === 'freeze' ? event.remaining_seconds : 0,
                },
              }
            : lane
        ),
      };
    });
  };

  const applyPriceUpdated = (event: PriceUpdatedEvent) => {
    queryClient.setQueryData<LiveState>(LIVE_STATE_QUERY_KEY(auctionId), (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lanes: prev.lanes.map((lane) =>
          lane.lane_id === event.lane_id && lane.current_item
            ? {
                ...lane,
                current_item: {
                  ...lane.current_item,
                  current_price: event.new_price,
                  active_bidders_count: event.active_bidders_count,
                  countdown_seconds: event.countdown_seconds,
                },
              }
            : lane
        ),
      };
    });
  };

  const applyBidderUpdated = (event: BidderUpdatedEvent) => {
    queryClient.setQueryData<LiveState>(LIVE_STATE_QUERY_KEY(auctionId), (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lanes: prev.lanes.map((lane) =>
          lane.lane_id === event.lane_id && lane.current_item
            ? {
                ...lane,
                current_item: {
                  ...lane.current_item,
                  active_bidders_count: event.active_bidders_count,
                },
              }
            : lane
        ),
      };
    });
  };

  const applyLaneChanged = (_event: LaneChangedEvent) => {
    // レーン変更時はサーバーから最新状態を再取得する
    // （自動入札による my_bid_status の変更を正確に反映するため）
    queryClient.invalidateQueries({ queryKey: LIVE_STATE_QUERY_KEY(auctionId) });
  };

  /** サーバーから強制再取得（エラー時・再接続時に使用） */
  const refetch = () =>
    queryClient.invalidateQueries({ queryKey: LIVE_STATE_QUERY_KEY(auctionId) });

  return {
    liveState: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
    // WebSocketハンドラ（useAuctionSocketに渡す）
    applyCountdownTick,
    applyPriceUpdated,
    applyBidderUpdated,
    applyLaneChanged,
  };
}
