import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Box, Grid, CircularProgress, Alert, Button,
  Paper, Typography, Snackbar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { EmojiEvents as EmojiEventsIcon } from '@mui/icons-material';
import axios from '@/lib/axios';
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

interface CelebrationItem {
  species_name: string;
  winning_price: number;
}

export default function AuctionLive() {
  const { auctionId: auctionIdStr } = useParams<{ auctionId: string }>();
  const auctionId = Number(auctionIdStr);
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

  // 入札ロジック（楽観的更新 + 自動ロールバック）
  const { toggle: handleBidToggle, isLocked } = useBidToggle(auctionId);

  // 落札一覧
  const { items: wonItems, totalAmount: wonTotalAmount, refetch: refetchWon } = useWonItems(auctionId);

  // 入室カウントダウン
  const { entranceCountdown } = useEntranceControl(entranceAllowed, entranceAt, () => {
    setEntranceAllowed(true);
    refetch();
  });

  // 指値モーダル用フック（選択中のアイテムの指値）
  // useBidLimit 内で enabled: itemId > 0 により、0 の場合はAPIを呼ばない
  const limitModalItem = limitModalItemId
    ? liveState?.lanes.find(l => l.current_item?.id === limitModalItemId)?.current_item ?? null
    : null;
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
        // 即座にキャッシュを更新（UIの即時反映）
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
        // サーバーからも再取得して確実に同期
        queryClient.invalidateQueries({ queryKey: ['auction-live', auctionId] });
        showSnackbar('金額が上昇しました。再度入札してください。', 'info');
      }
    },
    onBidderUpdated: (e) => {
      applyBidderUpdated(e);
      if (e.event_type === 'left') {
        queryClient.invalidateQueries({ queryKey: ['auction-live', auctionId] });
      }
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
        setStartingEndsAt(Date.now() + e.countdown_seconds * 1000);
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
      // 指値のキャッシュも無効化（レコード削除済みなので再取得で null になる）
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
  useEffect(() => {
    if (!liveCurrentItemIdsKey) return;
    const itemIds = liveCurrentItemIdsKey.split(',').map(Number);
    axios.post('/api/participant/favorites/check', { item_ids: itemIds })
      .then((r) => { if (r.data.success) setFavoriteIds(new Set(r.data.data.favorite_item_ids)); })
      .catch(() => {});
  }, [liveCurrentItemIdsKey]);

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
                          <TableCell>{item.item_number}</TableCell>
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
        onNavigateItems={() => navigate(`/participant/auction/${auctionId}/items`)}
      />

      <Container maxWidth="xl" sx={{ py: 2 }}>
        {/* レーングリッド */}
        <Grid container spacing={2}>
          {liveState.lanes.map((lane) => (
            <Grid item xs={12} sm={6} md={4} key={lane.lane_id}>
              <LaneCard
                lane={lane}
                isLoading={lane.current_item ? isLocked(lane.current_item.id) : false}
                onBidToggle={(itemId, status) => {
                  const item = lane.current_item;
                  if (item?.phase === 'pre_bid') {
                    showSnackbar('入札開始待機中です。もう少々お待ちください。', 'error');
                    return;
                  }
                  if (item?.phase === 'freeze') {
                    showSnackbar('誤タップ防止中です。もう少々お待ちください。', 'error');
                    return;
                  }
                  handleBidToggle(itemId, status);
                }}
                onDetailOpen={(l) => setDetailLane(l)}
                onLimitEdit={(itemId) => setLimitModalItemId(itemId)}
                onLimitRemove={(itemId) => {
                  setLimitModalItemId(itemId);
                }}
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
          isLive={true}
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
        onClose={() => setDetailLane(null)}
        isLoading={detailLane?.current_item ? isLocked(detailLane.current_item.id) : false}
        onBidToggle={(itemId, status) => {
          const lane = liveState.lanes.find(l => l.current_item?.id === itemId);
          const item = lane?.current_item;
          if (item?.phase === 'pre_bid') {
            showSnackbar('入札開始待機中です。もう少々お待ちください。', 'error');
            return;
          }
          if (item?.phase === 'freeze') {
            showSnackbar('誤タップ防止中です。もう少々お待ちください。', 'error');
            return;
          }
          handleBidToggle(itemId, status);
        }}
        onLimitEdit={(itemId) => setLimitModalItemId(itemId)}
        onLimitRemove={(itemId) => setLimitModalItemId(itemId)}
        isFavorited={(() => {
          const id = detailLane?.current_item?.id;
          return id ? favoriteIds.has(id) : false;
        })()}
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
