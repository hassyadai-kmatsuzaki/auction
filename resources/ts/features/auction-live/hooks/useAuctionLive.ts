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
    // 実装書 F7（追加）: 120 名同時負荷対策のためポーリング条件を最適化
    //   ・scheduled（待機室）: 10秒（旧 5秒、入室可否変化は数分単位でしか起きない）
    //   ・live + WebSocket 接続中: ポーリング無効（イベント駆動で十分）
    //   ・live + WebSocket 切断中: 5秒（旧 3秒、120 接続 × 3秒 = 40 req/秒の負荷を回避）
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'scheduled') return 10_000;
      return socketConnected ? false : 5_000;
    },
    // 実装書 F8: refetchOnWindowFocus を無効化
    //   旧設定: true → 120名がタブ切替する度に同時 refetch スパイク発生
    //   新設定: false → WebSocket イベントで状態同期するため不要
    refetchOnWindowFocus: false,
    // 実装書 F9: staleTime を伸ばして再 mount 時の不要 refetch を抑制
    //   旧 500ms → 新 30秒（WebSocket が主軸、初回 mount 以外は fetch 不要）
    staleTime: 30_000,
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

  const applyLaneChanged = (event: LaneChangedEvent) => {
    // 実装書 F10（追加）: 商品切替時に invalidateQueries で全 client refetch していた
    //   → 3 lanes × 100 商品 / 3h = 100 回の全件 refetch
    //   修正: イベント payload に含まれる current_item を直接 setQueryData で反映
    //   ※ my_bid_status の変更は別経路（auto-bid → BidderUpdated）で運ばれる
    queryClient.setQueryData<LiveState>(LIVE_STATE_QUERY_KEY(auctionId), (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lanes: prev.lanes.map((lane) =>
          lane.lane_id === event.lane_id
            ? {
                ...lane,
                current_item: event.current_item
                  ? ({ ...lane.current_item, ...event.current_item } as LaneItem)
                  : null,
              }
            : lane
        ),
      };
    });
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
