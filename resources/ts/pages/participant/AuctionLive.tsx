import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Box, Grid, CircularProgress, Alert, Button,
  Paper, Typography, Snackbar, useMediaQuery,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { EmojiEvents as EmojiEventsIcon } from '@mui/icons-material';
import axios from '@/lib/axios';
import { trackEvent } from '@/lib/track';
import { formatYen } from '@/lib/formatPrice';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useAuctionSocket } from '../../hooks/useAuctionSocket';
import { useSocketReconnect } from '../../hooks/useSocketReconnect';
import { useAuctionLiveStore } from '../../stores/auctionLiveStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useAuctionLive } from '../../features/auction-live/hooks/useAuctionLive';
import { useBidToggle } from '../../features/auction-live/hooks/useBidToggle';
import { useWonItems } from '../../features/auction-live/hooks/useWonItems';
import { useBidLimit, BID_LIMIT_QUERY_KEY } from '../../features/bid-limit/hooks/useBidLimit';
import { BidLimitModal } from '../../features/bid-limit/components/BidLimitModal';
import { useEntranceControl } from '../../features/auction-live/hooks/useEntranceControl';
import { LaneCard } from '../../features/auction-live/components/LaneCard';
import { AuctionHeader } from '../../features/auction-live/components/AuctionHeader';
import { optimizedImageUrl, prefetchImages } from '../../lib/optimizedMedia';
import { MyBidStatus } from '../../features/auction-live/components/MyBidStatus';
import { WonItemsPanel } from '../../features/auction-live/components/WonItemsPanel';
import { ItemDetailDialog } from '../../features/auction-live/components/ItemDetailDialog';
import { CelebrationOverlay } from '../../features/auction-live/components/CelebrationOverlay';
import { ConsentOverlay } from '../../features/auction-live/components/ConsentOverlay';
import { WaitingRoom, EntranceBlocked, StartingCountdown } from '../../features/auction-live/components/WaitingRoom';
import { UpcomingItems } from '../../features/auction-live/components/UpcomingItems';
import type { LiveLane, LaneItem } from '../../types';
import { SHOW_AUCTION_ITEM_LIST } from '../../lib/featureFlags';

interface CelebrationItem {
  species_name: string;
  winning_price: number;
}

/** SPコンパクトカードにサムネイルを表示するか（比較検討用スイッチ） */
const SHOW_COMPACT_THUMBNAIL = true;

export default function AuctionLive() {
  const { auctionId: auctionIdStr } = useParams<{ auctionId: string }>();
  const auctionId = Number(auctionIdStr);
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // 計測: 「オークション会場へ」＝ライブ画面到達（venue_enter）。全経路（ボタン/直リンク）を
  // ここ1点で捕捉。サーバ側で1ユーザー1オークション1行に重複排除（ライブ中も記録）。
  useEffect(() => {
    if (auctionId) trackEvent('venue_enter', { auction_id: auctionId });
  }, [auctionId]);

  // SP判定（4レーンを画面内に収めるコンパクト表示）
  //   縦向き: 幅 600px 未満のスマホ → リスト形式（1列）
  //   横向き: 高さ 500px 以下の横持ちスマホ → 2x2 グリッド
  //   ※ 横持ちスマホは幅が 800px 超になり breakpoints では拾えないため orientation で判定する
  const isPhonePortrait = useMediaQuery('(max-width: 599.95px) and (orientation: portrait)');
  const isPhoneLandscape = useMediaQuery('(max-height: 500px) and (orientation: landscape)');
  const isCompactLive = isPhonePortrait || isPhoneLandscape;

  // 横持ちスマホではグローバルヘッダー（ロゴ+メニュー）を隠してヘッダーを1列に集約し、
  // 4レーン（2x2）が縦に収まる高さを確保する（auction-live.css 参照）
  useEffect(() => {
    if (!isPhoneLandscape) return;
    document.body.classList.add('live-landscape-compact');
    return () => document.body.classList.remove('live-landscape-compact');
  }, [isPhoneLandscape]);

  // グローバルストア
  const socketConnected = useAuctionLiveStore((s) => s.socketConnected);
  const { snackbar, hideSnackbar, showSnackbar } = useNotificationStore();

  // ローカルUIState（ダイアログ等）
  const [detailLane, setDetailLane] = useState<LiveLane | null>(null);
  const [agreed, setAgreed] = useState(false);
  // null = 未確定（APIレスポンス待ち）、true/false = 確定
  const [entranceAllowed, setEntranceAllowed] = useState<boolean | null>(null);
  const [entranceAt, setEntranceAt] = useState<string | null>(null);
  /**
   * 開始カウントダウン表示値（0 以下 = 非表示、null = 未開始）
   *
   * ■ タイムスタンプ方式を採用
   *   - startingEndsAt: サーバーから受け取った残り秒数から計算した「終了時刻（ms）」
   *   - 表示値は Math.ceil((startingEndsAt - Date.now()) / 1000) で算出
   *   - ローカルタイマーのドリフトが発生しないためブラウザ間の差異が出ない
   *   - WebSocketが遅延しても表示はウォールクロックを基準にするため正確
   */
  const [startingEndsAt, setStartingEndsAt] = useState<number | null>(null);
  const [startingCountdown, setStartingCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /**
   * 開始カウントダウン完了フラグ
   * カウントダウンが0に到達した後、APIポーリングやWebSocketで
   * 再度 'starting' が返ってきても再表示しないためのガード
   */
  const countdownFinishedRef = useRef(false);
  const [celebration, setCelebration] = useState<CelebrationItem | null>(null);
  // 指値モーダル
  const [limitModalItemId, setLimitModalItemId] = useState<number | null>(null);
  // 現在商品のお気に入り状態（詳細モーダルのハートボタン用）
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  // WebSocket切断時の自動復旧
  useSocketReconnect(auctionId);

  // サーバー状態（TanStack Query）
  const {
    liveState,
    isLoading,
    error,
    refetch,
    applyCountdownTick,
    applyPriceUpdated,
    applyBidderUpdated,
    applyLaneChanged,
  } = useAuctionLive(auctionId);

  // 実装書 H2: liveState を ref で保持し、useCallback ハンドラから常に最新値を参照
  //   useCallback の依存配列に liveState を入れると毎レンダーで関数 ref が変わってしまうため、
  //   ref 経由で参照することで関数 ref を固定しつつ最新値にアクセスできる
  const liveStateRef = useRef(liveState);
  useEffect(() => {
    liveStateRef.current = liveState;
  }, [liveState]);

  // 入札ロジック（楽観的更新 + 自動ロールバック）
  const { toggle: handleBidToggle, isLocked } = useBidToggle(auctionId);

  // 実装書 F5: phase ガード付きの bid toggle ハンドラを useCallback で固定参照化
  //   inline lambda だと毎レンダーで関数 ref が変わり、LaneCard の React.memo が効かない
  //   この handler は (itemId, status, phase) を受け取り、phase 別ガードのみ担当
  const handleBidToggleWithGuard = useCallback(
    (itemId: number, status: 'active' | 'inactive' | null, phase?: string) => {
      if (phase === 'pre_bid') {
        showSnackbar('入札開始待機中です。もう少々お待ちください。', 'error');
        return;
      }
      if (phase === 'freeze') {
        showSnackbar('誤タップ防止中です。もう少々お待ちください。', 'error');
        return;
      }
      handleBidToggle(itemId, status);
    },
    [handleBidToggle, showSnackbar]
  );

  // 実装書 H2: ItemDetailDialog 用ハンドラも useCallback で固定参照化
  const handleDetailClose = useCallback(() => setDetailLane(null), []);
  const handleDetailBidToggle = useCallback(
    (itemId: number, status: 'active' | 'inactive' | null) => {
      // liveState はクロージャで毎回最新を参照するために liveStateRef を使う
      const item = liveStateRef.current?.lanes.find(l => l.current_item?.id === itemId)?.current_item;
      handleBidToggleWithGuard(itemId, status, item?.phase);
    },
    [handleBidToggleWithGuard]
  );
  // detailLane.current_item.id が favoriteIds に含まれているかを memo 化
  // ※ favoriteIds の宣言は L79、ここで参照するため後段で useMemo で算出する

  // 落札一覧
  const { items: wonItems, totalAmount: wonTotalAmount, refetch: refetchWon } = useWonItems(auctionId);

  // 入室カウントダウン
  const { entranceCountdown } = useEntranceControl(entranceAllowed, entranceAt, () => {
    setEntranceAllowed(true);
    refetch();
  });

  // 指値モーダル用フック（選択中のアイテムの指値）
  // useBidLimit 内で enabled: itemId > 0 により、0 の場合はAPIを呼ばない
  //
  // ライブ中の current_item と「次の商品」(upcoming_items) の両方を検索する。
  // upcoming_items にしか存在しない itemId（=次レーン表示の指値タップ）でも
  // モーダルを開けるようにするため、ヒットしたら start_price を current_price として扱う。
  const limitModalItem: { id: number; species_name: string; current_price: number; isUpcoming: boolean } | null = (() => {
    if (!limitModalItemId || !liveState) return null;
    for (const lane of liveState.lanes) {
      const ci = lane.current_item;
      if (ci && ci.id === limitModalItemId) {
        return { id: ci.id, species_name: ci.species_name, current_price: ci.current_price, isUpcoming: false };
      }
      const upcoming = lane.upcoming_items?.find(u => u.id === limitModalItemId);
      if (upcoming) {
        return {
          id: upcoming.id,
          species_name: upcoming.species_name,
          // 開始前商品なので「現在価格」は開始価格を使う（モーダルが isLive=false で扱う）
          current_price: upcoming.start_price,
          isUpcoming: true,
        };
      }
    }
    return null;
  })();
  const {
    limitPrice: modalLimitPrice,
    isTriggered: modalLimitTriggered,
    quickOptions: modalQuickOptions,
    setLimit: setModalLimit,
    removeLimit: removeModalLimit,
    isSetting: isModalSetting,
    isRemoving: isModalRemoving,
  } = useBidLimit(limitModalItemId ?? 0, auctionId); // auctionId を渡してライブ状態も再取得

  // WebSocketイベント購読
  useAuctionSocket({
    auctionId,
    onPriceUpdated: (e) => {
      applyPriceUpdated(e);
      if (user?.id && e.auto_left_user_ids?.includes(user.id)) {
        // 実装書 F1: invalidateQueries は除去（120 名負荷で全 client 同時 refetch によりサーバー過負荷）
        // setQueryData による楽観的更新で十分（WebSocket イベントが最新値を運んでくる）
        queryClient.setQueryData(['auction-live', auctionId], (prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            lanes: prev.lanes.map((lane: any) =>
              lane.current_item?.id === e.item_id
                ? { ...lane, current_item: { ...lane.current_item, my_bid_status: 'inactive' } }
                : lane
            ),
          };
        });
        showSnackbar('金額が上昇しました。再度入札してください。', 'info');
      }
    },
    onBidderUpdated: (e) => {
      applyBidderUpdated(e);
      // 実装書 F1: invalidateQueries は除去。bidder_updated イベント自体に最新カウントが含まれる
    },
    onLaneChanged: (e) => { applyLaneChanged(e); },
    onCountdownTick: (e) => { applyCountdownTick(e); },
    onItemSold: (e) => {
      if (e.winner_id === user?.id) {
        setCelebration({ species_name: e.species_name || '商品', winning_price: e.winning_price });
        showSnackbar(`🎉 おめでとうございます！${e.species_name || '商品'}を落札しました！`, 'success');
        setTimeout(() => setCelebration(null), 4000);
        refetchWon();
      } else {
        showSnackbar('商品が落札されました', 'success');
      }
    },
    onAuctionStatus: (e) => {
      if (e.status === 'starting' && e.countdown_seconds) {
        // カウントダウンが既に完了済みなら無視
        if (countdownFinishedRef.current) return;
        // サーバーの残り秒数から「終了時刻」を計算（タイムスタンプ方式）
        const newEndsAt = Date.now() + e.countdown_seconds * 1000;

        // 実装書 X3: 「10秒カウントダウンの途中で 10 がまた表示」事象の修正
        //
        // 原因: ProcessAuctionCountdownJob は late joiner 対応のため、pre-start 中に
        //       毎秒 AuctionStatusChanged(starting) を broadcast している。
        //       早期に接続済みのクライアントでは、ネットワーク遅延で broadcast が遅れて
        //       届くと ends_at が後ろにズレ、一瞬残り秒数が増えて見える。
        //
        // 修正: 既に startingEndsAt が設定されている場合、new の ends_at が
        //       既存値と「大きく異なる」時のみ採用。±1.5秒以内のズレは無視（duplicate）。
        //       これにより:
        //         - 初回受信 (prev=null): 採用 → late joiner も countdown を見られる
        //         - 毎秒の duplicate broadcast: 無視 → 表示の blip 防止
        //         - 大きく違う場合（再開等）: 採用 → recovery 機能維持
        setStartingEndsAt((prev) => {
          if (prev === null) return newEndsAt;
          const diff = Math.abs(newEndsAt - prev);
          // 1.5 秒以内のズレ = duplicate broadcast の遅延ジッター → 無視
          if (diff < 1500) return prev;
          // 大幅に異なる = 別セッション開始 or 時計補正 → 採用
          return newEndsAt;
        });
      } else if (e.status === 'live') {
        setStartingEndsAt(null);
        setStartingCountdown(null);
        // countdownFinishedRef のリセットは liveState が 'live' に確定してから行う
        // （ここで即リセットすると、refetch完了前に古い 'starting' 状態で再表示されるリスクがある）
        refetch();
      } else if (e.status === 'finished') {
        refetch();
        refetchWon();
        showSnackbar(e.message || 'オークションが終了しました', 'success');
      } else {
        // 上記以外（管理者による待機室公開・閉鎖 等）は最新状態を再取得
        refetch();
        if (e.message) showSnackbar(e.message, 'info');
      }
    },
    onBidLimitReached: (e) => {
      if (e.user_id !== user?.id) return;
      showSnackbar(
        e.message || `上限価格に達したため入札オフ・上限設定が解除されました`,
        'warning',
      );
      // 入札状態をキャッシュ上でも即時更新（指値解除済みなので my_limit_price も null に）
      queryClient.setQueryData(['auction-live', auctionId], (prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          lanes: prev.lanes.map((lane: any) =>
            lane.current_item?.id === e.item_id
              ? {
                  ...lane,
                  current_item: {
                    ...lane.current_item,
                    my_bid_status: 'inactive',
                    my_limit_price: null,
                    my_limit_triggered: false,
                  },
                }
              : lane
          ),
        };
      });
      // 実装書 F1: 指値レコード削除時のみ invalidateQueries（限定的な再取得）
      // 旧版は無条件 invalidate で全 client が refetch していたが、limit_cancelled=true の時のみに絞る
      if (e.limit_cancelled) {
        queryClient.invalidateQueries({ queryKey: BID_LIMIT_QUERY_KEY(e.item_id) });
      }
    },
    // 実装書 B2/B3: 指値同時発動の集約イベント（100名同価格対応）
    //   個別 bid.limit.reached が N 個飛んでくる代わりに、1 個の集約イベントで
    //   triggered[] 配列を受け取って自分が含まれている時だけ UI 反映する
    onBidLimitsBatchTriggered: (e) => {
      if (!user?.id) return;
      // 自分の指値発動を triggered 配列から探す。
      //
      // action 値の意味:
      //   - 'cancelled' = 発動時に active だった（手動入札中 → 自動離脱）
      //   - 'triggered' = 発動時に active でなかった（指値だけ持っていた / handlePriceIncrement で
      //                  先に deactivate された後に checkBidLimits が走ったケース）
      //
      // 旧版は 'cancelled' のみマッチしていたため、handlePriceIncrement → checkBidLimits の
      // 経路で自動離脱した自分の指値が「triggered」扱いになって UI 更新を取りこぼす事故になっていた。
      // protected=true は「指値が現在価格以上で保護された」状態なので除外する。
      const myEntry = e.triggered.find(
        (t) => t.user_id === user.id && !t.protected && (t.action === 'cancelled' || t.action === 'triggered')
      );
      if (!myEntry) return;

      showSnackbar(
        `上限価格 ¥${myEntry.limit_price.toLocaleString()} に達したため指値を解除しました`,
        'warning'
      );
      // setQueryData で my_bid_status / my_limit_price をローカルで即時無効化
      queryClient.setQueryData(['auction-live', auctionId], (prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          lanes: prev.lanes.map((lane: any) =>
            lane.current_item?.id === e.item_id
              ? {
                  ...lane,
                  current_item: {
                    ...lane.current_item,
                    my_bid_status: 'inactive',
                    my_limit_price: null,
                    my_limit_triggered: false,
                  },
                }
              : lane
          ),
        };
      });
      // 指値レコードキャッシュは batch なので必ず削除済 → invalidate
      queryClient.invalidateQueries({ queryKey: BID_LIMIT_QUERY_KEY(e.item_id) });
    },
  });

  // 価格・カウントダウン等で lanes の参照だけ変わることがあるため、current_item.id の集合が変わったときだけキーが更新されるようにする
  const liveCurrentItemIdsKey = useMemo(() => {
    if (!liveState?.lanes?.length) return '';
    const ids = liveState.lanes
      .map(l => l.current_item?.id)
      .filter((id): id is number => typeof id === 'number');
    return [...new Set(ids)].sort((a, b) => a - b).join(',');
  }, [liveState?.lanes]);

  // 現在商品のお気に入り状態を取得（詳細モーダルのハート表示用）
  //
  // 実装書 H3: AbortController で in-flight 重複リクエストを破棄し、サーバー負荷削減
  //   旧: liveCurrentItemIdsKey 変化のたびに POST、キャンセルなし
  //       → 商品切替 N 回が短時間に重なると N 件の同時 POST が走る
  //   新: 前リクエストを abort してから新規 POST を発行
  //       商品切替が 1 秒未満で連続しても、サーバーへ届くのは最後の 1 件
  const favoritesCheckAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!liveCurrentItemIdsKey) return;
    favoritesCheckAbortRef.current?.abort();
    const controller = new AbortController();
    favoritesCheckAbortRef.current = controller;
    const itemIds = liveCurrentItemIdsKey.split(',').map(Number);
    axios.post(
      '/api/participant/favorites/check',
      { item_ids: itemIds },
      { signal: controller.signal }
    )
      .then((r) => { if (r.data.success) setFavoriteIds(new Set(r.data.data.favorite_item_ids)); })
      .catch(() => {});
    return () => { controller.abort(); };
  }, [liveCurrentItemIdsKey]);

  // 実装書 H2: ItemDetailDialog の isFavorited を useMemo で memo 化
  //   旧: IIFE で毎レンダー再計算
  //   新: detailLane / favoriteIds 変化時のみ再算出
  const detailIsFavorited = useMemo(() => {
    const id = detailLane?.current_item?.id;
    return id ? favoriteIds.has(id) : false;
  }, [detailLane, favoriteIds]);

  const handleCurrentItemFavoriteToggle = async (itemId: number) => {
    try {
      const r = await axios.post('/api/participant/favorites/toggle', { item_id: itemId });
      if (r.data.success) {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          r.data.is_favorited ? next.add(itemId) : next.delete(itemId);
          return next;
        });
      }
    } catch {
      showSnackbar('お気に入りの更新に失敗しました', 'error');
    }
  };

  // 次の商品画像をプリフェッチ（商品切替時に即表示するため）
  useEffect(() => {
    if (!liveState?.lanes) return;
    const urls: string[] = [];
    for (const lane of liveState.lanes) {
      // 各レーンの次の商品のサムネイルをプリフェッチ
      if (lane.upcoming_items?.length) {
        for (const item of lane.upcoming_items.slice(0, 2)) {
          if (item.thumbnail_path) {
            urls.push(optimizedImageUrl(item.thumbnail_path, 'small'));
          }
        }
      }
    }
    if (urls.length > 0) {
      prefetchImages(urls);
    }
  }, [liveState?.lanes]);

  // liveState から入室制御情報を同期（useEffect内でstateを更新：レンダリング中のsetState禁止パターン回避）
  useEffect(() => {
    if (!liveState) return;

    const ea = liveState.entrance_allowed;
    if (ea !== undefined) {
      setEntranceAllowed(ea);
      if (!ea && liveState.entrance_at) {
        setEntranceAt(liveState.entrance_at);
      } else if (ea) {
        setEntranceAt(null); // 入室可能になったらリセット
      }
    }

    // 'live' になったらカウントダウン完了フラグをリセット（次回のオークション用）
    if (liveState.status === 'live') {
      countdownFinishedRef.current = false;
    }

    if (liveState.status === 'starting' && liveState.starting_countdown) {
      // カウントダウンが既に完了済みなら無視（0到達後のAPIレスポンスによる再表示を防止）
      if (countdownFinishedRef.current) return;

      // APIポーリングで取得した場合もタイムスタンプを設定
      // すでに startingEndsAt が設定されている場合は大きなずれがある時だけ上書き
      setStartingEndsAt(prev => {
        const serverEndsAt = Date.now() + (liveState.starting_countdown ?? 0) * 1000;
        if (prev === null) return serverEndsAt;
        // サーバー値との差が2秒以上ある場合のみ補正（APIポーリングによる不要なリセット防止）
        return Math.abs(prev - serverEndsAt) > 2000 ? serverEndsAt : prev;
      });
    }
  }, [liveState]);

  /**
   * 開始カウントダウンのタイムスタンプ方式タイマー
   *
   * ■ 設計思想
   *   - startingEndsAt（終了時刻ms）を基準にカウントダウン表示値を算出
   *   - 200ms ごとに Math.ceil((endsAt - Date.now()) / 1000) で表示値を更新
   *   - ローカルの setInterval は表示更新のみ（カウンター自体は保持しない）
   *   - ブラウザのタイマードリフトが蓄積しないため全ブラウザで誤差ゼロ
   *   - WebSocketやAPIポーリングで終了時刻が更新されれば自動的に補正される
   *   - カウントダウン完了後は countdownFinishedRef で再表示を防止
   */
  useEffect(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    if (startingEndsAt === null) {
      setStartingCountdown(null);
      return;
    }

    // 既にカウントダウン完了済みなら再開しない
    if (countdownFinishedRef.current) {
      setStartingCountdown(0);
      return;
    }

    const tick = () => {
      const remaining = Math.ceil((startingEndsAt - Date.now()) / 1000);
      if (remaining <= 0) {
        setStartingCountdown(0);
        countdownFinishedRef.current = true;
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        // 完了後は startingEndsAt もクリアして再トリガーを防止
        setStartingEndsAt(null);
        refetch();
        return;
      }
      setStartingCountdown(remaining);
    };

    tick(); // 即時表示
    countdownTimerRef.current = setInterval(tick, 200); // 200msごとに更新（スムーズ表示）

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [startingEndsAt, refetch]);

  // ========== ローディング / エラー ==========
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>データの取得に失敗しました。</Alert>
        <Button variant="contained" onClick={() => navigate('/participant')}>ホームに戻る</Button>
      </Container>
    );
  }

  if (!liveState) return null;

  // ========== 開始カウントダウン（最優先チェック） ==========
  //
  // ■ なぜここが最初か？
  //   待機室(scheduled)からカウントダウンが始まる際、WebSocketで
  //   AuctionStatusChanged('starting') を受け取り startingEndsAt が設定される。
  //   その時点では liveState.status がまだ 'scheduled' のままなので、
  //   scheduled チェックより前に置かないと WaitingRoom が表示されたままになる。
  //
  // ■ 表示条件
  //   - カウントダウン完了済みでない（countdownFinishedRef）
  //   - startingCountdown が 1 以上（0到達済みなら表示しない）
  //   - startingEndsAt が設定済み OR liveState.status が 'starting'
  //   - liveState.status が 'live' でない（ライブ開始後は表示しない）
  if (
    !countdownFinishedRef.current &&
    liveState.status !== 'live' &&
    (startingEndsAt !== null || liveState.status === 'starting') &&
    startingCountdown !== null && startingCountdown > 0
  ) {
    return <StartingCountdown title={liveState.auction_title} count={startingCountdown} />;
  }

  // startingEndsAt が設定済みだがタイマーがまだ初期化されていない場合（starting受信直後）
  // → 待機室に落ちないよう、カウントダウン画面を表示して待つ
  if (
    !countdownFinishedRef.current &&
    liveState.status !== 'live' &&
    (startingEndsAt !== null || liveState.status === 'starting')
  ) {
    return <StartingCountdown title={liveState.auction_title} count={startingCountdown ?? 10} />;
  }

  // ========== 入室不可 ==========
  if (liveState.status === 'scheduled' && entranceAllowed === false) {
    return (
      <EntranceBlocked
        title={liveState.auction_title}
        auctionId={auctionId}
        startAt={liveState.start_at}
        venueOpenMinutes={liveState.venue_open_minutes_before_start}
        message={liveState.message}
        entranceCountdown={entranceCountdown}
      />
    );
  }

  // ========== 待機室 ==========
  if (liveState.status === 'scheduled' && entranceAllowed === true) {
    return (
      <WaitingRoom
        title={liveState.auction_title}
        auctionId={auctionId}
        priceIncrementTiers={liveState.price_increment_tiers}
        countdownTiers={liveState.countdown_tiers}
      />
    );
  }

  // scheduled で entranceAllowed が null（未確定）の場合はローディング
  if (liveState.status === 'scheduled') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // ========== オークション終了 ==========
  if (liveState.status === 'finished') {
    return (
      <Box sx={{ bgcolor: 'grey.100', minHeight: 'calc(100vh - 64px)' }}>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Paper sx={{ p: 4, textAlign: 'center', mb: 3 }}>
            <EmojiEventsIcon sx={{ fontSize: 60, color: 'warning.main', mb: 2 }} />
            <Typography variant="h4" fontWeight="bold" gutterBottom>オークション終了</Typography>
            <Typography variant="h6" color="text.secondary">{liveState.auction_title}</Typography>
          </Paper>

          {wonItems.length > 0 && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmojiEventsIcon color="warning" /> あなたの落札結果
              </Typography>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ '& th, & td': { whiteSpace: 'nowrap' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>No.</TableCell><TableCell>品種</TableCell>
                      <TableCell align="right">単価</TableCell><TableCell align="right">数量</TableCell>
                      <TableCell align="right">合計(税込)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {wonItems.map((item) => {
                      const unit = item.quantity_unit === 'kg' ? 'kg' : item.quantity_unit === 'bag' ? '袋' : '匹';
                      return (
                        <TableRow key={item.id}>
                          <TableCell>{(item as any).exhibit_code ?? item.item_number}</TableCell>
                          <TableCell>{item.species_name}</TableCell>
                          <TableCell align="right">¥{formatYen(item.winning_price)}/1{unit}</TableCell>
                          <TableCell align="right">{item.quantity}{unit}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>¥{formatYen(item.total_amount)}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow>
                      <TableCell colSpan={4} align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>合計金額</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'primary.main' }}>
                        ¥{formatYen(wonTotalAmount)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          <Box sx={{ textAlign: 'center' }}>
            <Button variant="contained" size="large" onClick={() => navigate('/participant/won-items')}>
              落札管理へ
            </Button>
          </Box>
        </Container>
      </Box>
    );
  }

  // ========== ライブ画面 ==========
  return (
    <Box sx={{ bgcolor: 'grey.100', minHeight: 'calc(100vh - 64px)', position: 'relative' }}>
      {/* 同意画面（上がり幅・秒数の確認） */}
      {liveState.show_consent_screen && !agreed && (
        <ConsentOverlay
          onAgree={() => setAgreed(true)}
          priceIncrementTiers={liveState.price_increment_tiers}
          countdownTiers={liveState.countdown_tiers}
        />
      )}

      {/* 落札おめでとう演出 */}
      {celebration && (
        <CelebrationOverlay
          speciesName={celebration.species_name}
          winningPrice={celebration.winning_price}
        />
      )}

      {/* ヘッダー */}
      <AuctionHeader
        title={liveState.auction_title}
        activeLaneCount={liveState.lanes.filter(l => l.status === 'active').length}
        totalLaneCount={liveState.lanes.length}
        socketConnected={socketConnected}
        onRefresh={refetch}
        onNavigateItems={SHOW_AUCTION_ITEM_LIST ? () => navigate(`/participant/auction/${auctionId}/items`) : undefined}
        compact={isCompactLive}
        onMenuOpen={
          // 横持ちではグローバルヘッダー（ハンバーガー）が隠れるため、代替のメニュー起動を右端に出す
          isPhoneLandscape
            ? () => window.dispatchEvent(new Event('participant:open-menu'))
            : undefined
        }
      />

      <Container maxWidth="xl" sx={{ py: isCompactLive ? 0.5 : 2, px: isCompactLive ? 1 : undefined }}>
        {/* レーングリッド（横持ちスマホは 2x2 固定） */}
        <Grid container spacing={isCompactLive ? 1 : 2}>
          {liveState.lanes.map((lane) => (
            <Grid item xs={12} sm={6} md={isPhoneLandscape ? 6 : 4} key={lane.lane_id}>
              {/* 実装書 H2: inline lambda を削除して固定 ref ハンドラを渡す
                   →  LaneCard の React.memo が浅比較で正しく機能する */}
              <LaneCard
                lane={lane}
                isLoading={lane.current_item ? isLocked(lane.current_item.id) : false}
                onBidToggle={handleBidToggleWithGuard}
                onDetailOpen={setDetailLane}
                onLimitEdit={setLimitModalItemId}
                onLimitRemove={setLimitModalItemId}
                compact={isCompactLive}
                showThumbnail={SHOW_COMPACT_THUMBNAIL}
                roomy={isPhonePortrait && liveState.lanes.length <= 3}
              />
            </Grid>
          ))}
        </Grid>

        {/* 次の商品 */}
        <UpcomingItems
          lanes={liveState.lanes}
          onFavoriteToggle={async (itemId) => {
            try {
              await axios.post('/api/participant/favorites/toggle', { item_id: itemId });
              refetch();
            } catch {
              showSnackbar('お気に入りの更新に失敗しました', 'error');
            }
          }}
          onLimitEdit={(itemId) => setLimitModalItemId(itemId)}
        />

        {/* 自分の入札状況 */}
        <MyBidStatus
          lanes={liveState.lanes}
          onLeaveBid={(itemId) => handleBidToggle(itemId, 'active')}
        />

        {/* 落札一覧 */}
        <WonItemsPanel items={wonItems} totalAmount={wonTotalAmount} />
      </Container>

      {/* 指値（上限価格）設定モーダル */}
      {limitModalItemId && limitModalItem && (
        <BidLimitModal
          open={!!limitModalItemId}
          onClose={() => setLimitModalItemId(null)}
          itemId={limitModalItemId}
          speciesName={limitModalItem.species_name}
          currentLimitPrice={modalLimitPrice}
          currentPrice={limitModalItem.current_price}
          quickOptions={modalQuickOptions}
          isLive={!limitModalItem.isUpcoming}
          isSetting={isModalSetting}
          isRemoving={isModalRemoving}
          onSet={(price) => setModalLimit(price)}
          onRemove={() => removeModalLimit()}
        />
      )}

      {/* 詳細ダイアログ */}
      <ItemDetailDialog
        open={!!detailLane}
        item={
          (detailLane
            ? liveState.lanes.find(l => l.lane_id === detailLane.lane_id)?.current_item
            : null) as LaneItem | null
        }
        onClose={handleDetailClose}
        isLoading={detailLane?.current_item ? isLocked(detailLane.current_item.id) : false}
        onBidToggle={handleDetailBidToggle}
        onLimitEdit={setLimitModalItemId}
        onLimitRemove={setLimitModalItemId}
        isFavorited={detailIsFavorited}
        onFavoriteToggle={handleCurrentItemFavoriteToggle}
      />

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={hideSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={hideSnackbar}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
