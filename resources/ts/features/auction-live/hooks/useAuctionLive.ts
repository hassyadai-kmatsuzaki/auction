import { useEffect, useRef } from 'react';
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
    // 実装書 F7 + X2: 120 名同時負荷対策のためポーリング条件を最適化
    //   ・scheduled（待機室）: 30秒（X2: 旧 10秒からさらに緩和）
    //                         AuctionStatusChanged で即時切替可能なため保険程度
    //                         200名 × 10秒 → 30秒で req/秒 67% 削減
    //   ・live + WebSocket 接続中: ポーリング無効（イベント駆動で十分）
    //   ・live + WebSocket 切断中: 5秒（WS復旧までの絶対必須 fallback）
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'scheduled') return 30_000;
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

  // ─── 実装書 X1: WS message coalescing（requestAnimationFrame による集約）──
  //   バックグラウンドタブ復帰時など、短時間に多数の WS イベントが届いた場合、
  //   個別に setQueryData を呼ぶと N 回の React 再描画が発生する。
  //   rAF でフレームごとに集約することで、最大 60fps（16.7ms ごと）に絞る。
  //
  //   coalescing 戦略:
  //     - CountdownTick: lane_id ごとに最新値のみ保持（古いものは破棄）
  //     - PriceUpdated / BidderUpdated: lane_id ごとに最新値のみ保持
  //     - LaneChanged: lane_id ごとに最新値のみ保持
  //   → 同じ lane への連続イベントは「最新の状態」のみが反映される
  // ────────────────────────────────────────────────────────────────────────
  const pendingTicksRef = useRef<Map<number, CountdownTickEvent>>(new Map());
  const pendingPricesRef = useRef<Map<number, PriceUpdatedEvent>>(new Map());
  const pendingBiddersRef = useRef<Map<number, BidderUpdatedEvent>>(new Map());
  const pendingLaneChangesRef = useRef<Map<number, LaneChangedEvent>>(new Map());
  const rafIdRef = useRef<number | null>(null);

  const flushPending = () => {
    rafIdRef.current = null;
    const ticks = pendingTicksRef.current;
    const prices = pendingPricesRef.current;
    const bidders = pendingBiddersRef.current;
    const laneChanges = pendingLaneChangesRef.current;

    if (ticks.size === 0 && prices.size === 0 && bidders.size === 0 && laneChanges.size === 0) {
      return;
    }

    pendingTicksRef.current = new Map();
    pendingPricesRef.current = new Map();
    pendingBiddersRef.current = new Map();
    pendingLaneChangesRef.current = new Map();

    queryClient.setQueryData<LiveState>(LIVE_STATE_QUERY_KEY(auctionId), (prev) => {
      if (!prev?.lanes) return prev;
      let changed = false;
      const newLanes = prev.lanes.slice();

      // 1. LaneChanged を最初に適用（current_item の差し替え）
      laneChanges.forEach((event, laneId) => {
        const idx = newLanes.findIndex((l) => l.lane_id === laneId);
        if (idx === -1) return;
        newLanes[idx] = {
          ...newLanes[idx],
          current_item: event.current_item
            ? ({ ...newLanes[idx].current_item, ...event.current_item } as LaneItem)
            : null,
        };
        changed = true;
      });

      // 2. CountdownTick で時間/価格/フェーズを最新化
      ticks.forEach((event, laneId) => {
        const idx = newLanes.findIndex((l) => l.lane_id === laneId);
        if (idx === -1 || !newLanes[idx].current_item) return;
        const phase = event.phase ?? 'bidding';
        newLanes[idx] = {
          ...newLanes[idx],
          current_item: {
            ...newLanes[idx].current_item!,
            countdown_seconds:
              phase === 'bidding'
                ? event.remaining_seconds
                : newLanes[idx].current_item!.countdown_seconds,
            active_bidders_count: event.active_bidders_count,
            current_price: event.current_price,
            phase,
            pre_bid_remaining_seconds:
              phase === 'pre_bid' ? event.remaining_seconds : 0,
            freeze_remaining_seconds:
              phase === 'freeze' ? event.remaining_seconds : 0,
          },
        };
        changed = true;
      });

      // 3. PriceUpdated（CountdownTick より新しい価格情報があれば上書き）
      prices.forEach((event, laneId) => {
        const idx = newLanes.findIndex((l) => l.lane_id === laneId);
        if (idx === -1 || !newLanes[idx].current_item) return;
        newLanes[idx] = {
          ...newLanes[idx],
          current_item: {
            ...newLanes[idx].current_item!,
            current_price: event.new_price,
            active_bidders_count: event.active_bidders_count,
            countdown_seconds: event.countdown_seconds,
          },
        };
        changed = true;
      });

      // 4. BidderUpdated（active_bidders_count の最終値）
      bidders.forEach((event, laneId) => {
        const idx = newLanes.findIndex((l) => l.lane_id === laneId);
        if (idx === -1 || !newLanes[idx].current_item) return;
        if (newLanes[idx].current_item!.active_bidders_count === event.active_bidders_count) {
          return;
        }
        newLanes[idx] = {
          ...newLanes[idx],
          current_item: {
            ...newLanes[idx].current_item!,
            active_bidders_count: event.active_bidders_count,
          },
        };
        changed = true;
      });

      return changed ? { ...prev, lanes: newLanes } : prev;
    });
  };

  const scheduleFlush = () => {
    if (rafIdRef.current !== null) return;
    if (typeof requestAnimationFrame === 'undefined') {
      // SSR or 古いブラウザ環境のフォールバック
      flushPending();
      return;
    }
    rafIdRef.current = requestAnimationFrame(flushPending);
  };

  // unmount 時に rAF をキャンセル（メモリリーク防止）
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      pendingTicksRef.current.clear();
      pendingPricesRef.current.clear();
      pendingBiddersRef.current.clear();
      pendingLaneChangesRef.current.clear();
    };
  }, []);

  /**
   * WebSocket受信時にキャッシュを直接更新（再フェッチなし）
   *
   * 実装書 F14 + X1: rAF coalescing で同フレーム内の連続イベントを集約
   *   - lane_id ごとに最新値のみ保持（古いものは破棄）
   *   - 次の rAF tick で setQueryData を 1 回だけ呼ぶ
   *   - React 再描画を最大 60fps（16.7ms ごと）に絞る
   */
  const applyCountdownTick = (event: CountdownTickEvent) => {
    pendingTicksRef.current.set(event.lane_id, event);
    scheduleFlush();
  };

  const applyPriceUpdated = (event: PriceUpdatedEvent) => {
    pendingPricesRef.current.set(event.lane_id, event);
    scheduleFlush();
  };

  const applyBidderUpdated = (event: BidderUpdatedEvent) => {
    pendingBiddersRef.current.set(event.lane_id, event);
    scheduleFlush();
  };

  const applyLaneChanged = (event: LaneChangedEvent) => {
    // LaneChanged は coalescing しつつ、refetch も jitter 付きで実行
    pendingLaneChangesRef.current.set(event.lane_id, event);
    scheduleFlush();

    // lane changed 時には refetch も走らせて auto_bid 反映や server-only fields を取得
    // ただし jitter 付きで分散（120 名同時 refetch を回避）
    if (event.current_item) {
      const jitter = Math.floor(Math.random() * 1500); // 0-1.5 秒
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: LIVE_STATE_QUERY_KEY(auctionId),
          refetchType: 'active', // 表示中のクエリのみ refetch
        });
      }, jitter);
    }
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
