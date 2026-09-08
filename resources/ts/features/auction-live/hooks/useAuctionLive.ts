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

  // ─── B-1: 再取得タイマーを1本に集約する ───────────────────────────────
  //   旧実装は LaneChanged を受けるたびに setTimeout を張っていた（dedupe なし）。
  //   開始直後は 4 レーン分の LaneChanged と AuctionStatusChanged('live') が
  //   ほぼ同時に届くため、1 人あたり最大 5 本のタイマーが独立に発火し、
  //   500 名 × 最大 5 本 = 最大 2,000 件の GET /live が 3 秒間に集中していた。
  //   予約済みなら新たに張らないことで、どれだけイベントが重なっても 1 回に収束させる。
  // ────────────────────────────────────────────────────────────────────────
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        // A-2: 商品切替直後に届いた「前 item の遅延 tick」を新 item に誤適用しない。
        //   PriceUpdated 側（下の 3.）には元から同じガードがあるが tick 側に無く、
        //   切替直後に旧 item の tick が遅れて届くと新 item の価格・phase・人数を
        //   旧値で上書きしていた。pre_bid 中に入札ボタンが一瞬活性化する経路でもある。
        //   通常は次 tick で自己修復するが、レーンの進行状態が汚染されている間は持続する。
        if (event.item_id !== newLanes[idx].current_item!.id) return;
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

  // unmount 時に rAF と再取得タイマーをキャンセル（メモリリーク防止）
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      // B-1: 予約済みの再取得タイマーを破棄する。
      //   残したままだと、離脱後に invalidateQueries が走って無駄なリクエストになる。
      if (refetchTimerRef.current !== null) {
        clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
      pendingTicksRef.current.clear();
      pendingPricesRef.current.clear();
      pendingBiddersRef.current.clear();
      pendingLaneChangesRef.current.clear();
    };
  }, []);

  /**
   * B-1: 分散付きの再取得を「1本だけ」予約する。
   *
   *   - 既に予約済みなら何もしない。4 レーン同時切替でも実際の再取得は 1 回。
   *   - 既定（商品切替）は 1.5〜6.0 秒。
   *     下限 1.5 秒は落札→次商品の遷移窓（サーバー側で進行状態が
   *     一瞬空になる 1 秒未満の区間）を避けるため。ここに着弾すると
   *     cache-miss 復旧パスが旧商品でレーンを再生成しうる（2026-08-14 第7回）。
   *     上限 6.0 秒は 500 名を分散させるため。旧値 3.0 秒では
   *     500 名 ÷ 1.5 秒 = 330 件/秒 が着弾していた。
   *     切替時は LaneChanged 自体が current_item をキャッシュへ直接反映するので、
   *     この再取得は my_bid_status / 指値 / auto-bid 結果などの補完にすぎない。
   *
   *   - 開始時は呼び出し側が 0〜2.5 秒を渡す（下の注意を参照）。
   *
   *   ⚠ 開始時だけは事情が違う。ProcessAuctionCountdownJob は
   *     各レーンの startCountdown を済ませてから AuctionStatusChanged('live') を
   *     broadcast するが、このとき LaneItemChanged は飛ばない。
   *     つまり「最初の商品を画面に出す」唯一の経路がこの再取得になる。
   *     待たせすぎると商品が出ないまま参加者が待つことになるため、
   *     開始時は下限 0・上限 2.5 秒（500 名で約 200 件/秒）に狭める。
   *     lane は broadcast より前に live になっているので下限 0 でも古いデータは掴まない。
   */
  const scheduleRefetch = (minMs = 1500, maxMs = 6000) => {
    if (refetchTimerRef.current !== null) return;
    const span = Math.max(1, maxMs - minMs);
    const delay = minMs + Math.floor(Math.random() * span);
    refetchTimerRef.current = setTimeout(() => {
      refetchTimerRef.current = null;
      queryClient.invalidateQueries({
        queryKey: LIVE_STATE_QUERY_KEY(auctionId),
        refetchType: 'active', // 表示中のクエリのみ refetch
      });
    }, delay);
  };

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

    // lane changed 時には refetch も走らせて auto_bid 反映や server-only fields を取得。
    //
    // DEV-2026-011 (R6) の下限 1.5s は scheduleRefetch 側が引き継いでいる。
    // B-1: ここで直接 setTimeout を張るのをやめ、集約版に委譲する。
    //   旧実装はレーンごとに独立したタイマーを張っていたため、
    //   4 レーンが近接して切り替わると 1 人で 4 回 refetch していた。
    if (event.current_item) {
      scheduleRefetch();
    }
  };

  /**
   * サーバーから強制再取得（即時・分散なし）。
   *
   * ⚠ 全参加者が同時に踏む経路では使わないこと。500 名が同一秒に着弾する。
   *   一斉に発火しうる経路（AuctionStatusChanged / LaneChanged）は scheduleRefetch を使う。
   *   これを使ってよいのは、個別ユーザーの操作起因（入室・お気に入り操作など）に限る。
   */
  const refetch = () =>
    queryClient.invalidateQueries({ queryKey: LIVE_STATE_QUERY_KEY(auctionId) });

  return {
    liveState: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
    scheduleRefetch,
    // WebSocketハンドラ（useAuctionSocketに渡す）
    applyCountdownTick,
    applyPriceUpdated,
    applyBidderUpdated,
    applyLaneChanged,
  };
}
