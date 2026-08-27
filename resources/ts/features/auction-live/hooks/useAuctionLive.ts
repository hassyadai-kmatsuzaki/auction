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
      //
      // ■ item 切替時は個人状態（my_*）を必ず初期化する
      //   LaneItemChanged の broadcastWith は public channel 用の共通フィールドのみで、
      //   ユーザー個別の my_bid_status / my_limit_price / my_limit_triggered を含まない。
      //   素朴な { ...prev, ...event } マージだと、前 item で 'active' だった人の
      //   my_bid_status が新 item にそのまま引き継がれ、「最高入札者」表示が固定される事故になる
      //   （単独 active のまま次の item に進んだケースで顕在化）。
      //   item.id が変わったタイミングで個人状態をリセット → jitter 付き refetch で
      //   サーバー側の正しい値（事前指値など）に同期させる。
      laneChanges.forEach((event, laneId) => {
        const idx = newLanes.findIndex((l) => l.lane_id === laneId);
        if (idx === -1) return;
        if (!event.current_item) {
          newLanes[idx] = { ...newLanes[idx], current_item: null };
          changed = true;
          return;
        }
        const prev = newLanes[idx].current_item;
        const isItemSwitch = !prev || prev.id !== event.current_item.id;
        newLanes[idx] = {
          ...newLanes[idx],
          current_item: ({
            ...prev,
            ...event.current_item,
            ...(isItemSwitch && {
              my_bid_status: 'inactive' as const,
              my_limit_price: null,
              my_limit_triggered: false,
              // 切替直後は必ず pre_bid から始まる（MoveToNextItemAction が startPreBidCountdown を実行）。
              // LaneItemChanged のペイロードに phase が無く、放置すると直前 item の phase('bidding')を
              // 引き継いで入札ボタンが一瞬活性化してしまう。準備中側にフォールバックして誤タップを防ぐ。
              // 直後の countdown.tick / refetch でサーバーの正しい phase に上書きされる。
              phase: 'pre_bid' as const,
            }),
          } as LaneItem),
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
        const cur = newLanes[idx].current_item!;
        // 商品切替直後に届いた「前 item の遅延 price」を新 item に誤適用しない
        if (event.item_id !== cur.id) return;
        // 価格上昇 = サーバー側で必ず freeze が開始される合図（handlePriceIncrement /
        //   adjustPriceByBidLimits は PriceUpdated 直前に startFreezeCountdown 済み）。
        //   freeze を伝える countdown.tick は次 tick（最大0.5秒後）まで来ないため、
        //   ここで楽観的に freeze へ遷移させ、「カウントが次ラウンド秒に戻る → 0.5秒遅れて
        //   ボタンがフリーズ」という見た目のチラつきを防ぐ。
        //   countdown_seconds（次ラウンド秒）は freeze 表示中は不使用なので上書きしない。
        newLanes[idx] = {
          ...newLanes[idx],
          current_item: {
            ...cur,
            current_price: event.new_price,
            active_bidders_count: event.active_bidders_count,
            phase: 'freeze',
            freeze_remaining_seconds:
              cur.freeze_countdown_seconds ?? cur.freeze_remaining_seconds,
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
    //
    // DEV-2026-011 (R6): jitter に下限 1.5s を設ける。
    //   落札→次商品の遷移窓（サーバー側で countdown cache が空になる 1 秒未満の区間）に
    //   refetch が着弾すると、cache-miss 復旧パスが走る。サーバー側は Cache::add で上書きを
    //   防いでいるが、そもそも窓の外に着弾させる。価格・カウントは WS で即時反映済みなので
    //   auto_bid 等の反映が最大 1.5s 遅れても体感影響はない。
    if (event.current_item) {
      const jitter = 1500 + Math.floor(Math.random() * 1500); // 1.5-3.0 秒（遷移窓の外）
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
